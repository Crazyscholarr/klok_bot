import { workerData, parentPort } from 'worker_threads';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { ethers } from 'ethers';
import axios from 'axios';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Đọc danh sách câu hỏi từ file messages.txt
const MESSAGES = (() => {
    try {
        return fs.readFileSync(path.join(__dirname, 'messages.txt'), 'utf8')
            .split('\n').map(l => l.trim()).filter(l => l);
    } catch (error) {
        console.error(chalk.red('Lỗi khi đọc file danh sách câu hỏi:'), error.message);
        return [];
    }
})();

// Hàm tiện ích
const log = (msg, accountIndex) => {
    const date = new Date();
    const vnTime = date.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false });
    const vnDay = date.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).split('/').map(d => d.padStart(2, '0')).join('-');
    const timeDay = chalk.cyan(`[${vnTime} | ${vnDay}]`);
    const tag = chalk.magenta(`[Crazyscholar @ KLOL]`);
    const account = chalk.green(`|Account ${accountIndex}|`);
    parentPort.postMessage(`${timeDay} ${tag} ${account} | ${msg}`);
};

const dynamicDelay = () => Math.random() * 5000 + 1000;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function retry(fn, retries = 3, delayMs = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await delay(delayMs * Math.pow(2, i));
            log(chalk.yellow(`Thử lại lần ${i + 1} sau lỗi: ${error.message}`), workerData.accountIndex);
        }
    }
}

const THREAD_DELAY = Math.random() * (workerData.MAX_THREAD_DELAY) * 1000;

// Hàm lấy IP thực tế từ proxy
async function getIpFromProxy(proxy) {
    if (!proxy) return "N/A";
    const config = { httpsAgent: new HttpsProxyAgent(proxy), timeout: 5000 };
    try {
        const response = await axios.get("https://api.ipify.org?format=json", config);
        return chalk.green(`Proxy ${proxy} hoạt động, IP: ${response.data.ip}`);
    } catch (error) {
        return chalk.red(`Proxy ${proxy} không hoạt động: ${error.message}`);
    }
}

// Hàm giải reCAPTCHA v3 bằng Capsolver và lấy token trực tiếp
async function solveCapsolver(accountIndex) {
    if (!workerData.capsolver) {
        throw new Error("workerData.capsolver không tồn tại. Kiểm tra cấu hình config.yaml.");
    }

    const apiKey = workerData.capsolver.api_key;
    const websiteURL = workerData.capsolver.website_url;
    const websiteKey = workerData.capsolver.website_key;

    if (!apiKey || !websiteURL || !websiteKey) {
        throw new Error("Thiếu thông tin Capsolver: api_key, website_url hoặc website_key không tồn tại.");
    }

    let retries = 5;
    try {
        log(chalk.green(`⏳ Đang tạo task giải reCAPTCHA v3 với Capsolver...`), accountIndex);
        const taskResponse = await axios.post(
            "https://api.capsolver.com/createTask",
            {
                clientKey: apiKey,
                task: {
                    type: "ReCaptchaV3TaskProxyless",
                    websiteURL: websiteURL,
                    websiteKey: websiteKey,
                    pageAction: "login",
                    isEnterprise: true,
                }
            },
            {
                headers: { "Content-Type": "application/json" },
                timeout: 10000 // Thêm timeout để tránh treo
            }
        );

        const taskId = taskResponse.data.taskId;
        if (!taskId) {
            throw new Error(`Tạo task thất bại: ${JSON.stringify(taskResponse.data)}`);
        }
        log(chalk.green(`✅ Task đã được tạo, taskId: ${taskId}`), accountIndex);

        let result;
        do {
            await delay(5000); // Giảm thời gian chờ từ 10s xuống 5s để tối ưu
            const resultResponse = await axios.post(
                "https://api.capsolver.com/getTaskResult",
                {
                    clientKey: apiKey,
                    taskId: taskId
                },
                {
                    headers: { "Content-Type": "application/json" },
                    timeout: 10000
                }
            );
            result = resultResponse.data;
            if (result.status === "processing") {
                log(chalk.yellow(`⏳ reCAPTCHA v3 đang được xử lý...`), accountIndex);
            }
            retries--;
        } while (result.status === "processing" && retries > 0);

        if (result.status === "ready") {
            const captchaToken = result.solution.gRecaptchaResponse;
            log(chalk.green(`✅ Giải reCAPTCHA v3 thành công`), accountIndex); // Ẩn token để log gọn hơn
            return captchaToken;
        } else {
            throw new Error(`Không thể giải reCAPTCHA v3: ${JSON.stringify(result)}`);
        }
    } catch (error) {
        log(chalk.red(`Lỗi khi giải reCAPTCHA v3 với Capsolver: ${error.message}`), accountIndex);
        throw error;
    }
}

function createApiClient(token, proxy) {
    const axiosConfig = {
        baseURL: workerData.base.api_base_url,
        headers: {
            'x-session-token': token,
            'accept': '*/*',
            'accept-encoding': 'gzip, deflate, br, zstd',
            'accept-language': 'en-US,en;q=0.9',
            'origin': 'https://klokapp.ai',
            'referer': 'https://klokapp.ai/',
            'sec-ch-ua': '"Not(A:Brand";v="99", "Microsoft Edge";v="133", "Chromium";v="133"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'same-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 Edg/133.0.0.0'
        },
        timeout: 10000 // Thêm timeout cho các request
    };

    if (proxy) {
        const isSocksProxy = proxy.includes('socks');
        const agentOptions = { rejectUnauthorized: true };
        if (isSocksProxy) {
            axiosConfig.httpAgent = new SocksProxyAgent(proxy, agentOptions);
            axiosConfig.httpsAgent = new SocksProxyAgent(proxy, agentOptions);
        } else {
            axiosConfig.httpAgent = new HttpsProxyAgent(proxy, agentOptions);
            axiosConfig.httpsAgent = new HttpsProxyAgent(proxy, agentOptions);
        }
    }

    return axios.create(axiosConfig);
}

class Worker {
    constructor(workerData, accountIndex) {
        this.workerData = workerData;
        this.chatList = [];
        this.modelsList = [];
        this.threadId = null;
        this.selectModel = null;
        this.chatTitle = null;
        this.wallet = new ethers.Wallet(workerData.privateKey);
        this.client = createApiClient("", workerData.proxy);
        this.accountIndex = accountIndex;
        this.totalPoints = 0;
        log(chalk.yellow(`👛 Ví ${this.wallet.address.slice(0, 6)}... Bắt đầu chạy`), this.accountIndex);
    }

    async checkPoints() {
        log(chalk.green(`⏳ Lấy thông tin điểm hiện tại...`), this.accountIndex);
        const response = await retry(() => this.client.get('/points'));
        const pointsData = response.data;
        this.totalPoints = pointsData.total_points || 0;
        log(chalk.green(` Điểm trò chuyện: ${pointsData.points?.inference || 0}`), this.accountIndex);
        log(chalk.green(` Điểm mời: ${pointsData.points?.referral || 0}`), this.accountIndex);
        log(chalk.green(` Điểm theo dõi Twitter Mira: ${pointsData.points?.twitter_mira || 0}`), this.accountIndex);
        log(chalk.green(` Điểm theo dõi Twitter Klok: ${pointsData.points?.twitter_klok || 0}`), this.accountIndex);
        log(chalk.green(` Điểm theo dõi Discord: ${pointsData.points?.discord || 0}`), this.accountIndex);
        log(chalk.green(` Tổng điểm: ${this.totalPoints}`), this.accountIndex);
        log(chalk.green(`========================\x1b[0m\n`), this.accountIndex);
        return pointsData;
    }

    async checkTwitterMiraTask() {
        log(chalk.green(`⏳ Kiểm tra trạng thái nhiệm vụ Twitter Mira...`), this.accountIndex);
        const response = await retry(() => this.client.get('/points/action/twitter_mira'));
        const result = response.data;
        if (!result?.has_completed) {
            await delay(dynamicDelay());
            log(chalk.green(`✅ Nhiệm vụ chưa hoàn thành, đang thực hiện...`), this.accountIndex);
            await this.client.post('/points/action/twitter_mira');
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành`), this.accountIndex);
        } else {
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành trước đó`), this.accountIndex);
        }
    }

    async checkTwitterKlokTask() {
        log(chalk.green(`⏳ Kiểm tra trạng thái nhiệm vụ Twitter Klok...`), this.accountIndex);
        const response = await retry(() => this.client.get('/points/action/twitter_klok'));
        const result = response.data;
        if (!result?.has_completed) {
            await delay(dynamicDelay());
            log(chalk.green(`✅ Nhiệm vụ chưa hoàn thành, đang thực hiện...`), this.accountIndex);
            await this.client.post('/points/action/twitter_klok');
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành`), this.accountIndex);
        } else {
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành trước đó`), this.accountIndex);
        }
    }

    async checkDiscordTask() {
        log(chalk.green(`⏳ Kiểm tra trạng thái nhiệm vụ Discord...`), this.accountIndex);
        const response = await retry(() => this.client.get('/points/action/discord'));
        const result = response.data;
        if (!result?.has_completed) {
            await delay(dynamicDelay());
            log(chalk.green(`✅ Nhiệm vụ chưa hoàn thành, đang thực hiện...`), this.accountIndex);
            await this.client.post('/points/action/discord');
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành`), this.accountIndex);
        } else {
            log(chalk.green(`✅ Nhiệm vụ đã hoàn thành trước đó`), this.accountIndex);
        }
    }

    async checkSocialTask() {
        await Promise.all([
            this.checkTwitterMiraTask(),
            this.checkTwitterKlokTask(),
            this.checkDiscordTask()
        ]); // Chạy song song để tối ưu thời gian
    }

    async getNonce() {
        const nonce = ethers.hexlify(ethers.randomBytes(48)).substring(2);
        const messageToSign = [
            `klokapp.ai wants you to sign in with your Ethereum account:`,
            this.wallet.address,
            ``,
            ``,
            `URI: https://klokapp.ai/`,
            `Version: 1`,
            `Chain ID: 1`,
            `Nonce: ${nonce}`,
            `Issued At: ${new Date().toISOString()}`,
        ].join("\n");
        const signature = await this.wallet.signMessage(messageToSign);
        return { signature, messageToSign };
    }

    async login() {
        const { signature, messageToSign } = await this.getNonce();
        const recaptchaToken = await solveCapsolver(this.accountIndex);
        const loginBody = {
            signedMessage: signature,
            message: messageToSign,
            referral_code: workerData.base.referral_code || null,
            recaptcha_token: recaptchaToken,
        };
        log(chalk.green(`🔐 Đang kiểm tra chữ ký ví...`), this.accountIndex);
        const logRes = await retry(() => this.client.post('/verify', loginBody));
        log(chalk.green(`🔐 ✅ Đăng nhập thành công`), this.accountIndex);
        this.client.defaults.headers['x-session-token'] = logRes.data.session_token;
        return logRes.data.session_token;
    }

    async getModels() {
        log(chalk.green(`⏳ Đang tải danh sách mô hình...`), this.accountIndex);
        const response = await retry(() => this.client.get('/models'));
        const modelData = response.data;
        log(chalk.green(`========================\x1b[0m\n`), this.accountIndex);
        const modelsList = modelData?.filter(model => model.active)?.map(model => model.name) || [];
        this.modelsList = modelsList;
        this.selectModel = modelsList[Math.floor(Math.random() * modelsList.length)];
        log(chalk.green(`✅ Đã tải danh sách mô hình, chọn: ${this.selectModel}`), this.accountIndex);
    }

    async createChat(maxIterations = 100) {
        for (let i = 0; i < maxIterations; i++) {
            if (!this.threadId) {
                this.threadId = crypto.randomUUID();
            }
            const question = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
            log(`❓ Câu hỏi: ${question}`, this.accountIndex);
            const postMessages = this.chatList.concat([{ role: "user", content: question }]);
            const payload = {
                id: this.threadId,
                created_at: new Date().toISOString(),
                language: workerData.base.language || 'english',
                model: this.selectModel,
                messages: postMessages,
                sources: [],
                title: this.chatTitle || '',
            };
            const response = await retry(() => this.client.post('/chat', payload));
            log(chalk.green(`✅ Đã nhận câu trả lời từ mô hình`), this.accountIndex);
            
            if (this.chatList.length >= 100) this.chatList.shift();
            this.chatList.push({ role: 'assistant', content: response.data });

            if (!this.chatTitle) {
                const title = await retry(() => this.client.post('/chat/title', {
                    id: this.threadId,
                    language: workerData.base.language || 'english',
                    messages: postMessages,
                    model: this.selectModel,
                }));
                this.chatTitle = title.data?.title;
            }
            await this.checkPoints();
            await delay(dynamicDelay());
        }
    }

    sendPoints() {
        parentPort.postMessage({ type: 'points', points: this.totalPoints });
    }
}

async function mainLoop(accountIndex) {
    let worker = null;
    try {
        log(chalk.yellow(`⇄ Bắt đầu đăng nhập..., sử dụng proxy ${workerData.proxy || 'không có'}`), accountIndex);
        const proxyIp = await getIpFromProxy(workerData.proxy);
        if (proxyIp.includes("không hoạt động")) {
            throw new Error('Proxy không hoạt động, bỏ qua Account này');
        }
        log(proxyIp, accountIndex);
        worker = new Worker(workerData, accountIndex);
        await worker.login();
        await worker.checkPoints();
        await worker.getModels();
        await worker.checkSocialTask();
        await worker.createChat();
        worker.sendPoints();
    } catch (error) {
        log(chalk.red(`Lỗi quy trình: ${error.message}`), accountIndex);
    } finally {
        const totalPoints = worker ? worker.totalPoints : 0;
        log(chalk.yellow(`Hoàn thành quy trình cho account ${accountIndex}, tổng điểm: ${totalPoints}`), accountIndex);
    }
}

async function startWithDelay(accountIndex) {
    log(chalk.yellow(`⏳ Account sẽ bắt đầu sau ${(THREAD_DELAY / 1000).toFixed(1)} giây...`), accountIndex);
    await delay(THREAD_DELAY);
    mainLoop(accountIndex);
}

startWithDelay(workerData.accountIndex);