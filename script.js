document.addEventListener('DOMContentLoaded', function() {
    // 监听粘贴事件
    document.addEventListener('paste', handlePaste);

    // 监听文件上传
    document.getElementById('imageUpload').addEventListener('change', handleFileSelect);

    // 监听LaTeX输入变化
    document.getElementById('latexInput').addEventListener('input', renderLaTeX);

    // 监听API密钥保存按钮
    document.getElementById('saveApiKeyButton').addEventListener('click', saveApiKey);

    // 初始化KaTeX渲染
    renderLaTeX();

    // 尝试从本地存储加载API密钥
    loadApiKey();
});

// 模型配置
modelConfig = {
    "Qwen2.5-VL-32B": {
        name: "Qwen/Qwen2.5-VL-32B-Instruct",
    },
    "Qwen2.5-VL-7B": {
        name: "Pro/Qwen/Qwen2.5-VL-7B-Instruct",
    },
}

// 保存API密钥
function saveApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const apiKey = apiKeyInput.value.trim();

    if (apiKey) {
        localStorage.setItem('apiKey', apiKey);
        alert('API密钥已保存！');
    } else {
        alert('请输入有效的API密钥');
    }
}

// 加载API密钥
function loadApiKey() {
    const apiKeyInput = document.getElementById('apiKeyInput');
    const savedApiKey = localStorage.getItem('apiKey');

    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }
}

// 处理粘贴事件
function handlePaste(e) {
    // 检查当前焦点是否在输入框上
    const focusedElement = document.activeElement;
    const apiKeyInput = document.getElementById('apiKeyInput');
    const latexInput = document.getElementById('latexInput');

    // 如果焦点在输入框上，则允许正常粘贴
    if (focusedElement === apiKeyInput || focusedElement === latexInput) {
        return;
    }

    // 检查粘贴内容是否为图片
    const clipboardData = e.clipboardData || e.originalEvent.clipboardData;
    const items = clipboardData.items;

    // 假设默认是文本
    let isImage = false;

    for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
            isImage = true;
            break;
        }
    }

    if (isImage) {
        e.preventDefault();
        let blob = null;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                blob = items[i].getAsFile();
                break;
            }
        }

        if (blob) {
            processImage(blob);
        }
    }
    // 如果不是图片，允许正常粘贴
}

// 处理文件选择
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        processImage(file);
    }
}

// 处理图片
function processImage(file) {
    const reader = new FileReader();

    reader.onload = function(event) {
        const base64Data = event.target.result.split(',')[1];

        // 显示图片预览
        const imagePreview = document.getElementById('imagePreview');
        imagePreview.innerHTML = `<img src="${event.target.result}" class="img-fluid">`;

        // 调用自定义API
        callCustomAPI(base64Data);
    };

    reader.readAsDataURL(file);
}

// 调用自定义API
async function callCustomAPI(base64Data) {
    try {
        // 检查网络连接
        if (!navigator.onLine) {
            alert('当前无网络连接，请检查您的网络设置。');
            return;
        }

        // 获取API密钥
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        if (!apiKey) {
            alert('请输入有效的API密钥');
            return;
        }

        // 获取模型选择器
        const modelSelect = document.getElementById('modelSelect');
        const modelName = modelConfig[modelSelect.value].name;
        const url = "https://api.siliconflow.cn/v1/chat/completions";
        const prompts = "请把图中的公式转成latex格式，不要输出其他内容，包括latex代码前后的$$符号";

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Data}`,
                                    detail: "high"
                                }
                            },
                            {
                                type: "text",
                                text: prompts
                            }
                        ]
                    }
                ],
                stream: false,
                temperature: 0.7,
                top_p: 0.7,
                top_k: 50,
                max_tokens: 1024,
                stop: null,
                presence_penalty: 0.5,
                n: 1,
                response_format: { type: "text" }
            })
        });

        if (!response.ok) {
            throw new Error(`API调用失败，状态码: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
            // 获取LaTeX代码
            let latexCode = data.choices[0].message.content;

            // 使用正则表达式匹配并删除首尾的$$符号及其附近的换行符
            latexCode = latexCode.replace(/^\s*\$\$[\r\n]*|[\r\n]*\$\$\s*$/g, '');

            // 更新输入框和渲染
            document.getElementById('latexInput').value = latexCode;
            renderLaTeX();
        } else {
            alert('无法提取LaTeX代码，请尝试其他图片。');
        }
    } catch (error) {
        console.error('Error:', error);
        if (error.message.includes('Failed to fetch')) {
            alert('API链接解析失败，请检查链接的合法性和网络连接。');
        } else {
            alert('API调用失败，请检查网络连接或API密钥。');
        }
    }
}

// 渲染LaTeX
function renderLaTeX() {
    const latexInput = document.getElementById('latexInput').value;
    const formulaDisplay = document.getElementById('formulaDisplay');

    // 清空之前的渲染
    formulaDisplay.innerHTML = '';

    // 使用KaTeX渲染
    try {
        katex.render(latexInput, formulaDisplay, {
            throwOnError: false,
            displayMode: true
        });
    } catch (error) {
        formulaDisplay.innerHTML = `<div class="text-danger">渲染错误: ${error.message}</div>`;
    }
}