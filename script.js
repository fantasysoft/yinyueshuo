document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const audioInput = document.getElementById('audioInput');
    const textInput = document.getElementById('textInput');
    const currentCount = document.getElementById('currentCount');
    const generateBtn = document.getElementById('generateBtn');
    const originalAudioSection = document.getElementById('originalAudioSection');
    const generatedAudioSection = document.getElementById('generatedAudioSection');
    const originalAudio = document.getElementById('originalAudio');
    const downloadBtn = document.getElementById('downloadBtn');
    const loadingOverlay = document.querySelector('.loading-overlay');
    const toast = document.getElementById('toast');

    // 添加提示函数
    function showToast(message, type = 'error') {
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';
        
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // 上传区域点击事件
    uploadArea.addEventListener('click', () => {
        audioInput.click();
    });

    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#007AFF';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '#ccc';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#ccc';
        const file = e.dataTransfer.files[0];
        handleAudioFile(file);
    });

    // 文件选择处理
    audioInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleAudioFile(file);
    });

    // 处理音频文件
    let audioFile = null;
    function handleAudioFile(file) {
        // 检查文件类型
        const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a'];
        if (!allowedTypes.includes(file.type)) {
            showToast('请上传 WAV、MP3 或 M4A 格式的音频文件');
            return;
        }

        // 检查文件大小（限制为 10MB）
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast('音频文件大小不能超过 10MB');
            return;
        }

        // 检查文件时长
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        
        audio.addEventListener('loadedmetadata', () => {
            if (audio.duration > 60) {
                showToast('音频长度不能超过60秒');
                return;
            }
            
            audioFile = file;
            originalAudio.src = URL.createObjectURL(file);
            originalAudioSection.hidden = false;
            generateBtn.disabled = false;
            showToast('音频上传成功', 'success');
        });

        audio.addEventListener('error', () => {
            showToast('音频文件损坏或格式不支持');
        });
    }

    // 文字计数
    textInput.addEventListener('input', () => {
        const count = textInput.value.length;
        currentCount.textContent = count;
    });

    // 生成按钮点击事件
    generateBtn.addEventListener('click', async () => {
        if (!audioFile || !textInput.value) {
            showToast('请先上传音频并输入文字');
            return;
        }

        await generateClonedAudio();
    });

    // 下载按钮点击事件
    downloadBtn.addEventListener('click', () => {
        const audioElement = document.getElementById('generatedAudio');
        if (!audioElement.src) {
            showToast('请先生成音频');
            return;
        }

        try {
            const downloadLink = document.createElement('a');
            downloadLink.href = audioElement.src;
            downloadLink.download = `克隆音频_${new Date().getTime()}.mp3`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            showToast('下载开始', 'success');
        } catch (error) {
            showToast('下载失败，请重试');
        }
    });

    // 修改生成音频的核心逻辑
    async function generateAudio(voiceId, text) {
        try {
            console.log('Generating audio for voice:', voiceId);
            const response = await fetch('http://localhost:3000/api/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice_id: voiceId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '音频生成失败');
            }

            const result = await response.json();
            
            if (!result.url) {
                throw new Error('未获取到音频URL');
            }

            const audio = new Audio();
            audio.src = result.url;

            await new Promise((resolve, reject) => {
                audio.onloadeddata = resolve;
                audio.onerror = () => reject(new Error('音频加载失败'));
                setTimeout(() => reject(new Error('音频加载超时')), 30000);
            });

            return audio;
        } catch (error) {
            console.error('Generate audio error:', error);
            throw error;
        }
    }

    // 修改生成函数，只支持声音克隆
    async function generateClonedAudio() {
        try {
            generateBtn.disabled = true;
            generateBtn.textContent = '生成中...';
            loadingOverlay.style.display = 'flex';

            // 克隆声音
            showToast('正在克隆声音...', 'info');
            const formData = new FormData();
            formData.append('voice_name', `Custom Voice ${new Date().getTime()}`);
            formData.append('sample_file', audioFile);

            const response = await fetch('http://localhost:3000/api/clone', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '声音克隆失败');
            }

            const result = await response.json();
            const voiceId = result.voice_id;

            // 生成音频
            showToast('正在生成音频...', 'info');
            const audio = await generateAudio(voiceId, textInput.value);
            document.getElementById('generatedAudio').src = audio.src;
            generatedAudioSection.hidden = false;
            showToast('音频生成成功！', 'success');

        } catch (error) {
            console.error('Complete error:', error);
            showToast(error.message);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '生成克隆音频';
            loadingOverlay.style.display = 'none';
        }
    }
}); 