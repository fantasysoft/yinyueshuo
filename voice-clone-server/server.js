const express = require('express');
const cors = require('cors');
const multer = require('multer');
const upload = multer();
const fetch = require('node-fetch');
const FormData = require('form-data');

const app = express();

// 允许所有跨域请求
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'xi-api-key', 'Authorization'],
    exposedHeaders: ['Content-Type', 'Content-Length']
}));

app.use(express.json());

const API_KEY = 'sk_acd03d74d6712b7a83e613da132b5615b90d10d934e67619';
const API_BASE_URL = 'https://api.elevenlabs.io/v1';

// 添加请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// 声音克隆接口
app.post('/api/clone', upload.single('sample_file'), async (req, res) => {
    try {
        console.log('Received clone request:', {
            body: req.body,
            file: req.file ? {
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            } : null
        });
        
        const formData = new FormData();
        formData.append('name', req.body.voice_name);
        formData.append('description', 'Custom cloned voice');
        formData.append('files', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype
        });

        console.log('Sending request to ElevenLabs...');
        const response = await fetch(`${API_BASE_URL}/voices/add`, {
            method: 'POST',
            headers: {
                'xi-api-key': API_KEY,
                ...formData.getHeaders()
            },
            body: formData
        }).catch(error => {
            console.error('Network error:', error);
            throw new Error('网络连接失败，请检查网络设置');
        });

        const data = await response.json().catch(error => {
            console.error('Parse response error:', error);
            throw new Error('解析响应数据失败');
        });
        
        console.log('Clone response:', data);

        if (!response.ok) {
            if (data.detail && typeof data.detail === 'object') {
                throw new Error(data.detail.message || JSON.stringify(data.detail));
            } else {
                throw new Error(data.detail || '声音克隆失败');
            }
        }

        res.json({
            voice_id: data.voice_id,
            status: 'completed'
        });
    } catch (error) {
        console.error('Clone error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 文本转语音接口
app.post('/api/tts', async (req, res) => {
    try {
        console.log('Received TTS request:', {
            text_length: req.body.text.length,
            voice_id: req.body.voice_id
        });
        
        // 分段处理长文本
        const maxLength = 1000; // ElevenLabs 建议的最大长度
        const textChunks = [];
        let text = req.body.text;
        
        while (text.length > 0) {
            // 在标点符号处分段
            let chunkEnd = Math.min(text.length, maxLength);
            const punctuations = ['\n', '。', '！', '？', '；', '，'];
            
            for (let p of punctuations) {
                const lastIndex = text.lastIndexOf(p, maxLength);
                if (lastIndex > 0) {
                    chunkEnd = lastIndex + 1;
                    break;
                }
            }
            
            textChunks.push(text.slice(0, chunkEnd));
            text = text.slice(chunkEnd);
        }

        // 处理每个文本段
        const audioChunks = [];
        for (let chunk of textChunks) {
            console.log(`Processing chunk of length ${chunk.length}...`);
            const response = await fetch(`${API_BASE_URL}/text-to-speech/${req.body.voice_id}/stream`, {
                method: 'POST',
                headers: {
                    'xi-api-key': API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: chunk,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.0,
                        use_speaker_boost: true
                    },
                    output_format: "mp3_44100_128",
                    optimize_streaming_latency: 3
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '音频生成失败');
            }

            const buffer = await response.arrayBuffer();
            audioChunks.push(Buffer.from(buffer));
        }

        // 合并所有音频段
        const audioBuffer = Buffer.concat(audioChunks);
        const audioBase64 = audioBuffer.toString('base64');
        const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

        res.json({ url: audioUrl });
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取声音列表
app.get('/api/voices', async (req, res) => {
    try {
        console.log('Getting voice list...');
        const response = await fetch(`${API_BASE_URL}/voices`, {
            headers: {
                'xi-api-key': API_KEY
            }
        }).catch(error => {
            console.error('Network error:', error);
            throw new Error('网络连接失败，请检查网络设置');
        });

        const data = await response.json().catch(error => {
            console.error('Parse response error:', error);
            throw new Error('解析响应数据失败');
        });

        console.log('Available voices:', data);

        if (!response.ok) {
            throw new Error(data.detail || '获取声音列表失败');
        }

        res.json(data.voices);
    } catch (error) {
        console.error('Get voices error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 健康检查接口
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API endpoints:`);
    console.log(`- POST http://localhost:${PORT}/api/tts`);
    console.log(`- GET http://localhost:${PORT}/api/voices`);
    console.log(`- POST http://localhost:${PORT}/api/clone`);
    console.log(`- GET http://localhost:${PORT}/health`);
}); 