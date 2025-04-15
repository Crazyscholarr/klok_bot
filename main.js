import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import cron from 'node-cron';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = (() => {
    try {
        const configPath = path.join(__dirname, 'config.yaml');
        console.log(chalk.yellow(`📄 Đang đọc file cấu hình: ${configPath}`));
        const configData = yaml.load(fs.readFileSync(configPath, 'utf8'));
        return configData;
    } catch (error) {
        console.error(chalk.red('Lỗi khi đọc file cấu hình:'), error.message);
        process.exit(1);
    }
})();

const PRIVATE_KEYS = (() => {
    try {
        return fs.readFileSync(path.join(__dirname, 'private_keys.txt'), 'utf8')
            .split('\n').map(l => l.trim()).filter(l => l);
    } catch (error) {
        console.error(chalk.red('Lỗi khi đọc file khóa riêng:'), error.message);
        return [];
    }
})();

const PROXY_URLS = (() => {
    try {
        return fs.readFileSync(path.join(__dirname, 'proxies.txt'), 'utf8')
            .split('\n').map(l => l.trim()).filter(l => l);
    } catch (error) {
        console.error(chalk.red('Lỗi khi đọc file proxy:'), error.message);
        return [];
    }
})();

// Lưu trữ điểm của từng Account
const pointsSummary = new Map();

function printSummary() {
    console.log(chalk.magenta(`----------------------------------------------------------------------------------------`));
    console.log(chalk.magenta(`                              TỔNG KẾT                              `));
    pointsSummary.forEach((points, accountIndex) => {
        console.log(chalk.cyan(`Account ${accountIndex}: ${points} point`));
    });
    console.log(chalk.magenta(`----------------------------------------------------------------------------------------`));
}

async function startWorkers() {
    let currentIndex = 0;
    let activeWorkers = 0;
    const maxThreads = config.runner.thread_count || 5;

    function createNextWorker() {
        while (activeWorkers < maxThreads && currentIndex < PRIVATE_KEYS.length) {
            const privateKey = PRIVATE_KEYS[currentIndex];
            const proxy = PROXY_URLS[currentIndex % PROXY_URLS.length] || null;
            const workerIndex = ++currentIndex;
            activeWorkers++;
            const worker = new Worker(path.join(__dirname, 'worker.js'), {
                workerData: {
                    ...config,
                    privateKey: privateKey,
                    proxy,
                    accountIndex: workerIndex,
                    MAX_THREAD_DELAY: config.runner.max_thread_delay || 60,
                }
            });

            worker.on('message', msg => {
                if (typeof msg === 'object' && msg.type === 'points') {
                    pointsSummary.set(workerIndex, msg.points);
                } else {
                    console.log(msg);
                }
            });

            worker.on('error', err => {
                console.log(chalk.red(`[Account ${workerIndex}] Lỗi: ${err.message}`));
            });

            worker.on('exit', code => {
                activeWorkers--;
                console.log(chalk.yellow(`[Account ${workerIndex}] Đã thoát, mã ${code}`));
                
                createNextWorker();
                
                if (currentIndex >= PRIVATE_KEYS.length && activeWorkers === 0) {
                    console.log(chalk.green(`Chương trình đã hoàn thành, đang tổng kết điểm:`));
                    printSummary();
                    console.log(chalk.green(`Chờ để chương trình tự hoạt động lại...`));
                    setTimeout(() => {
                        currentIndex = 0;
                        activeWorkers = 0;
                        createNextWorker();
                    }, 60000);
                }
            });
        }
    }

    console.log(chalk.green(`🚀 Khởi động nhóm Account động (tối đa ${maxThreads} Account)`));
    createNextWorker();
}

function main() {
    console.log(chalk.bold.green("=================== Robot tự động Klok ==================="));
    
    if (!PRIVATE_KEYS.length) {
        console.log(chalk.red("❌ Không tìm thấy khóa riêng hợp lệ, vui lòng kiểm tra private_keys.txt"));
        process.exit(1);
    }

    cron.schedule(config.scheduler?.jobs?.[0]?.schedule || "0 8 * * *", () => {
        console.log(chalk.cyan(`\n🕒 ${new Date().toLocaleString()} Kích hoạt nhiệm vụ định kỳ`));
        startWorkers();
    }, {
        scheduled: true,
        timezone: "Asia/Ho_Chi_Minh"
    });
    startWorkers();
}

main();