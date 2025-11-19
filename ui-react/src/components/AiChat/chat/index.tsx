import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Message} from "ai/react";
import {toast} from "react-toastify";
import {uploadImage} from "@/api/chat";
import useChatStore from "../../../stores/chatSlice";
import {useFileStore} from "../../WeIde/stores/fileStore";
import {db} from "../../../utils/indexDB";
import {v4 as uuidv4} from "uuid";
import {eventEmitter} from "../utils/EventEmitter";
import {MessageItem} from "./components/MessageItem";
import {ChatInput, ChatMode} from "./components/ChatInput";
import Tips from "./components/Tips";
import {parseMessage} from "../../../utils/messagepParseJson";
import useUserStore from "../../../stores/userSlice";
import {useLimitModalStore} from "../../UserModal";
import {updateFileSystemNow} from "../../WeIde/services";
import {parseMessages, useChatWebSocket} from "../useMessageParser";
import {createMpIcon} from "@/utils/createWtrite";
import {useTranslation} from "react-i18next";
import { apiUrl } from "@/api/base";
import useChatModeStore from "../../../stores/chatModeSlice";
import useTerminalStore from "@/stores/terminalSlice";
import {checkExecList, checkFinish} from "../utils/checkFinish";
import {useUrlData} from "@/hooks/useUrlData";
import {MCPTool} from "@/types/mcp";
import useMCPTools from "@/hooks/useMCPTools";
import {FileSystemStatus} from "./components/FileSystemStatus";
import {handleFileSystemEvent, isFileSystemEvent} from "../utils/fileSystemEventHandler";

type AttachmentWithLocal = {
    id: string;
    name: string;
    type?: string;
    localUrl?: string;
    contentType?: string;
    url?: string;
};

type WeMessages = (Message & {
    experimental_attachments?: AttachmentWithLocal[];
})[]
type TextUIPart = {
    type: 'text';
    /**
     * The text content.
     */
    text: string;
};
const ipcRenderer = window?.electron?.ipcRenderer;
export const excludeFiles = [
    "components/weicon/base64.js",
    "components/weicon/icon.css",
    "components/weicon/index.js",
    "components/weicon/index.json",
    "components/weicon/index.wxml",
    "components/weicon/icondata.js",
    "components/weicon/index.css",
    "/miniprogram/components/weicon/base64.js",
    "/miniprogram/components/weicon/icon.css",
    "/miniprogram/components/weicon/index.js",
    "/miniprogram/components/weicon/index.json",
    "/miniprogram/components/weicon/index.wxml",
    "/miniprogram/components/weicon/icondata.js",
    "/miniprogram/components/weicon/index.css",
];

// 统一通过 apiUrl 构造请求地址，避免 APP_BASE_URL 未配置导致的 undefined 前缀

enum ModelTypes {
    Claude37sonnet = "claude-3-7-sonnet-20250219",
    Claude35sonnet = "claude-3-5-sonnet-20240620",
    gpt4oMini = "gpt-4o-mini",
    DeepseekR1 = "DeepSeek-R1",
    DeepseekV3 = "deepseek-chat",
}

export interface IModelOption {
    value: string;
    label: string;
    useImage: boolean;
    quota: number;
    from?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    provider?: string;
    functionCall?: boolean;
}

function convertToBoltAction(obj: Record<string, string>): string {
    return Object.entries(obj)
        .filter(([filePath]) => !excludeFiles.includes(filePath))
        .map(
            ([filePath, content]) =>
                `<boltAction type="file" filePath="${filePath}">\n${content}\n</boltAction>`
        )
        .join("\n\n");
}

export const BaseChat = ({uuid: propUuid}: { uuid?: string }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const {otherConfig} = useChatStore();
    const {t} = useTranslation();
    const [checkCount, setCheckCount] = useState(0);

    const [baseModal, setBaseModal] = useState<IModelOption>({
        value: ModelTypes.Claude35sonnet,
        label: "Claude 3.5 Sonnet",
        useImage: true,
        from: "default",
        quota: 2,
        functionCall: true,
    });
    const {
        files,
        isFirstSend,
        isUpdateSend,
        setIsFirstSend,
        setIsUpdateSend,
        setFiles,
        setEmptyFiles,
        errors,
        updateContent,
        clearErrors,
        setOldFiles
    } = useFileStore();
    const {mode} = useChatModeStore();
    // 使用全局状态
    const {
        uploadedImages,
        addImages,
        removeImage,
        clearImages,
        setModelOptions,
    } = useChatStore();
    const {resetTerminals} = useTerminalStore();
    const filesInitObj = {} as Record<string, string>;
    const filesUpdateObj = {} as Record<string, string>;
    Object.keys(isFirstSend).forEach((key) => {
        isFirstSend[key] && (filesInitObj[key] = files[key]);
    });
    Object.keys(isUpdateSend).forEach((key) => {
        isUpdateSend[key] && (filesUpdateObj[key] = files[key]);
    });

    const initConvertToBoltAction = convertToBoltAction({
        ...filesInitObj,
        ...filesUpdateObj,
    });

    const updateConvertToBoltAction = convertToBoltAction(filesUpdateObj);

    // 获取模型列表（初始加载）
    useEffect(() => {
        fetch(apiUrl('/api/model/list'), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((res) => res.json())
            .then((data) => {
                console.log("Fetched model list:", data);
                if (Array.isArray(data)) {
                    setModelOptions(data);
                    // 如果获取到模型列表，设置第一个模型为默认选择
                    if (data.length > 0) {
                        const firstModel = data[0];
                        console.log("Setting default model:", firstModel);
                        setBaseModal(firstModel);
                    }
                } else {
                    console.error("Invalid model list format:", data);
                    setModelOptions([]);
                }
            })
            .catch((error) => {
                console.error("Failed to fetch model list:", error);
                setModelOptions([]);
            });
    }, []);



    useEffect(() => {
        if (
            (messages.length === 0 &&
                initConvertToBoltAction &&
                mode === ChatMode.Builder) ||
            (messages.length === 1 &&
                messages[0].id === "1" &&
                initConvertToBoltAction &&
                mode === ChatMode.Builder)
        ) {
            setMessages([
                {
                    id: "1",
                    role: "user",
                    content: `<boltArtifact id="hello-js" title="the current file">\n${initConvertToBoltAction}\n</boltArtifact>\n\n`,
                },
            ])
            scrollToBottom();
        }
    }, [initConvertToBoltAction]);

    useEffect(() => {
        if (
            messages.length > 1 &&
            updateConvertToBoltAction &&
            mode === ChatMode.Builder
        ) {
            setMessages((list) => {
                const newList = [...list];
                if (newList[newList.length - 1].id !== "2") {
                    newList.push({
                        id: "2",
                        role: "user",
                        content: `<boltArtifact id="hello-js" title="Currently modified files">\n${updateConvertToBoltAction}\n</boltArtifact>\n\n`,
                    });
                } else if (newList[newList.length - 1].id === "2") {
                    newList[newList.length - 1].content =
                        `<boltArtifact id="hello-js" title="Currently modified files">\n${updateConvertToBoltAction}\n</boltArtifact>\n\n`;
                }
                scrollToBottom();
                return newList;
            });
        }
    }, [updateConvertToBoltAction]);

    // 修改 UUID 的初始化逻辑和消息加载
    const [chatUuid, setChatUuid] = useState(() => propUuid || uuidv4());

    const refUuidMessages = useRef([]);
    const [userScrolling, setUserScrolling] = useState(false);
    const userScrollTimeoutRef = useRef<NodeJS.Timeout>();

    // 处理用户滚动
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;
        const isScrolledToBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;

        if (!isScrolledToBottom) {
            setUserScrolling(true);

            if (userScrollTimeoutRef.current) {
                clearTimeout(userScrollTimeoutRef.current);
            }

            userScrollTimeoutRef.current = setTimeout(() => {
                setUserScrolling(false);
            }, 3000);
        }
    };

    const scrollToBottom = useCallback(() => {
        if (userScrolling) return;

        const messageContainer = document.querySelector('.message-container');
        if (messageContainer) {
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }
    }, [userScrolling]);

    useEffect(() => {
        return () => {
            if (userScrollTimeoutRef.current) {
                clearTimeout(userScrollTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (checkCount >= 1) {
            checkFinish(messages[messages.length - 1].content, append, t);
            checkExecList(messages);
            setCheckCount(0);
        }
    }, [checkCount]);

    // 添加加载历史消息的函数
    const loadChatHistory = async (uuid: string) => {
        try {
            const records = await db.getByUuid(uuid);
            if (records.length > 0) {
                const latestRecord = records[0];
                if (latestRecord?.data?.messages) {
                    const historyFiles = {};
                    const oldHistoryFiles = {};
                    // setEmptyFiles();
                    ipcRenderer && ipcRenderer.invoke("node-container:set-now-path", "");
                    latestRecord.data.messages.forEach((message) => {
                        const {files: messageFiles} = parseMessage(message.content);
                        Object.assign(historyFiles, messageFiles);
                    });
                    const assistantRecord = latestRecord.data.messages.filter(e => e.role === "assistant")
                    if (assistantRecord.length > 1) {
                        const oldRecords = assistantRecord[1];
                        const {files: messageFiles} = parseMessage(oldRecords.content);
                        Object.assign(oldHistoryFiles, messageFiles);
                    }
                    if (mode === ChatMode.Builder) {
                        latestRecord.data.messages.push({
                            id: uuidv4(),
                            role: "user",
                            content: `<boltArtifact id="hello-js" title="the current file">\n${convertToBoltAction(historyFiles)}\n</boltArtifact>\n\n`,
                        });
                    }
                    setMessages(latestRecord.data.messages as WeMessages);
                    setFiles(historyFiles);
                    setOldFiles(oldHistoryFiles);
                    // 重置其他状态
                    clearImages();
                    setIsFirstSend();
                    setIsUpdateSend();
                    resetTerminals();
                }
            } else {
                // 如果是新对话，清空所有状态
                setMessages([]);
                clearImages();
                setIsFirstSend();
                setIsUpdateSend();
            }
        } catch (error) {
            toast.error("加载聊天记录失败");
        }
    };

    // 监听聊天选择事件
    useEffect(() => {
        const unsubscribe = eventEmitter.on("chat:select", (uuid: string) => {
            console.log("chat:select event received", { uuid, currentChatUuid: chatUuid });

            // 如果是新聊天（uuid为空字符串）或者切换到不同的聊天
            if (!uuid || uuid !== chatUuid) {
                console.log("Processing chat selection", { isNewChat: !uuid, isDifferentChat: uuid !== chatUuid });
                refUuidMessages.current = [];

                if (uuid) {
                    // 切换到已存在的聊天，使用传入的uuid
                    setChatUuid(uuid);
                    // 加载历史记录
                    loadChatHistory(uuid);
                } else {
                    // 新对话，生成新的uuid并清空所有状态
                    const newUuid = uuidv4();
                    console.log("Starting new chat with UUID:", newUuid);
                    setChatUuid(newUuid);
                    setMessages([]);
                    setFiles({});
                    clearImages();
                    setIsFirstSend();
                    setIsUpdateSend();
                    if (ipcRenderer) {
                        setEmptyFiles();
                        ipcRenderer.invoke("node-container:set-now-path", "");
                        setFiles({});
                        clearImages();
                        setIsFirstSend();
                        setIsUpdateSend();
                        resetTerminals();
                    }
                }
            } else {
                console.log("Chat selection ignored - same chat UUID");
            }
        });

        // 清理订阅
        return () => unsubscribe();
    }, [chatUuid, files]);
    const token = useUserStore.getState().token;
    const {openModal} = useLimitModalStore();

    const [messages, setMessages] = useState<WeMessages>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(event.target.value);
    }, []);
    const {enabledMCPs} = useMCPTools()

    const [mcpTools, setMcpTools] = useState<MCPTool[]>([])
    useEffect(() => {
        // MCP tools are not available in Web mode
        setMcpTools([])
    }, [enabledMCPs])

    const chatWebSocketUrl = useMemo(() => {
        const backendBase =
            process.env.APP_BASE_URL ||
            process.env.APP_WS_BASE_URL ||
            process.env.VITE_PROXY_TARGET ||
            "";

        const configuredUrl = (() => {
            if (process.env.APP_WS_BASE_URL) {
                return process.env.APP_WS_BASE_URL;
            }
            if (backendBase) {
                const normalizedBase = backendBase.endsWith("/")
                    ? backendBase.slice(0, -1)
                    : backendBase;
                return `${normalizedBase}/api/chat/ws`;
            }
            return apiUrl("/api/chat/ws");
        })();

        const resolveAbsoluteUrl = (target: string) => {
            if (target.startsWith('ws')) return target;
            if (target.startsWith('http')) {
                return target.replace(/^http/, 'ws');
            }
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const normalized = target.startsWith('/') ? target : `/${target}`;
            return `${protocol}//${window.location.host}${normalized}`;
        };

        const resolved = resolveAbsoluteUrl(configuredUrl);
        if (token) {
            try {
                const url = new URL(resolved);
                url.searchParams.set('token', token);
                return url.toString();
            } catch (error) {
                console.warn('[ChatWebSocket] URL 解析失败，回退为原始地址', error);
            }
        }
        return resolved;
    }, [token]);

    const handleWebSocketError = useCallback((error: Error | Event) => {
        const message = (error as Error)?.message || String(error);
        console.error('[ChatWebSocket] 连接错误:', error);
        setIsLoading(false);
        toast.error(message);
        if (message.includes("Quota not enough")) {
            openModal('limit');
        }
        if (message.includes("Authentication required")) {
            openModal("login");
        }
    }, [openModal]);

    const finalizeAssistantMessage = useCallback(async (updatedMessages: WeMessages) => {
        clearImages();
        scrollToBottom();
        setIsLoading(false);

        try {
            const needParseMessages = updatedMessages.filter(
                (m) => !refUuidMessages.current.includes(m.id)
            );

            if (needParseMessages.length) {
                refUuidMessages.current = [
                    ...refUuidMessages.current,
                    ...needParseMessages.map((m) => m.id),
                ];
                await parseMessages(needParseMessages);
            }

            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (lastMessage?.content) {
                const parseResult = parseMessage(lastMessage.content);
                const {files: messagefiles} = parseResult;
                for (let key in messagefiles) {
                    await updateContent(key, messagefiles[key], false, true);
                }
            }

            setIsFirstSend();
            setIsUpdateSend();

            await db.insert(chatUuid, {
                messages: updatedMessages,
                title:
                    updatedMessages.find(
                        (m) => m.role === "user" && !m.content.includes("<boltArtifact")
                    )?.content?.slice(0, 50) || "New Chat",
            });
        } catch (error) {
            console.error('[ChatWebSocket] finalize message error:', error);
        }

        setCheckCount((count) => count + 1);
    }, [chatUuid, clearImages, parseMessages, scrollToBottom, setIsFirstSend, setIsUpdateSend, updateContent]);

    const handleAssistantStream = useCallback((assistantMessage: Message, meta?: { isFinal?: boolean }) => {
        if (!assistantMessage) {
            return;
        }

        let nextMessagesSnapshot: WeMessages = [];
        setMessages((prev) => {
            const assistantEntry: WeMessages[number] = {
                id: assistantMessage.id || uuidv4(),
                role: assistantMessage.role || "assistant",
                content: assistantMessage.content || "",
            };
            const existingIndex = prev.findIndex((msg) => msg.id === assistantEntry.id);
            let nextMessages: WeMessages;
            if (existingIndex >= 0) {
                nextMessages = [
                    ...prev.slice(0, existingIndex),
                    {...prev[existingIndex], ...assistantEntry},
                    ...prev.slice(existingIndex + 1),
                ];
            } else {
                nextMessages = [...prev, assistantEntry];
            }
            nextMessagesSnapshot = nextMessages;
            return nextMessages;
        });
        scrollToBottom();
        if (meta?.isFinal && nextMessagesSnapshot.length) {
            finalizeAssistantMessage(nextMessagesSnapshot);
        }
    }, [finalizeAssistantMessage, scrollToBottom]);

    const { sendMessage: sendWebSocketMessage, disconnect } = useChatWebSocket(chatWebSocketUrl, {
        onMessage: handleAssistantStream,
        onError: handleWebSocketError,
    });

    const buildToolsPayload = useCallback(() => {
        if (!baseModal.functionCall || mcpTools.length === 0) {
            return undefined;
        }
        return mcpTools.map(tool => ({
            id: tool.id,
            name: `${tool.serverName}.${tool.name}`,
            description: tool.description || "",
            parameters: tool.inputSchema
        }));
    }, [baseModal.functionCall, mcpTools]);

    const sendChatRequest = useCallback((conversation: WeMessages) => {
        if (!conversation.length) {
            return;
        }

        console.log("[Chat] 准备发送消息", {
            mode,
            conversationLength: conversation.length,
            wsUrl: chatWebSocketUrl,
            lastRole: conversation[conversation.length - 1]?.role,
        });

        const payloadMessages = conversation.map(({experimental_attachments, ...rest}) => ({
            ...rest,
            ...(experimental_attachments ? {experimental_attachments} : {}),
        })) as Message[];

        const body: {
            messages: Message[];
            model?: string;
            mode?: string;
            otherConfig?: any;
            tools?: any[];
        } = {
            messages: payloadMessages,
            model: baseModal.value,
            mode: mode,
            otherConfig: {
                ...otherConfig,
                extra: {
                    ...otherConfig.extra,
                    isBackEnd: otherConfig.isBackEnd,
                    backendLanguage: otherConfig.backendLanguage
                },
            },
        };

        const tools = buildToolsPayload();
        if (tools) {
            body.tools = tools;
        }

        setIsLoading(true);
        sendWebSocketMessage(body);
    }, [baseModal.value, mode, otherConfig, buildToolsPayload, sendWebSocketMessage, chatWebSocketUrl]);

    const append = useCallback((
        message: { role: 'user' | 'assistant'; content: string },
        options?: { experimental_attachments?: WeMessages[number]['experimental_attachments'] }
    ) => {
        let nextMessagesSnapshot: WeMessages = [];
        setMessages((prev) => {
            const newMessage: WeMessages[number] = {
                id: uuidv4(),
                role: message.role,
                content: message.content,
            };
            if (options?.experimental_attachments) {
                newMessage.experimental_attachments = options.experimental_attachments;
            }
            const nextMessages = [...prev, newMessage];
            console.log("[Chat] append", {
                role: message.role,
                prevCount: prev.length,
                nextCount: nextMessages.length,
            });
            nextMessagesSnapshot = nextMessages;
            return nextMessages;
        });

        if (message.role === "user" && nextMessagesSnapshot.length) {
            console.log("[Chat] 发送请求", {
                mode,
                snapshotLength: nextMessagesSnapshot.length,
            });
            sendChatRequest(nextMessagesSnapshot);
        }
    }, [mode, sendChatRequest]);

    const stop = useCallback(() => {
        disconnect();
        setIsLoading(false);
    }, [disconnect]);

    const reload = useCallback(() => {
        let snapshot: WeMessages | null = null;
        setMessages((prev) => {
            let lastUserIndex = -1;
            for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].role === "user") {
                    lastUserIndex = i;
                    break;
                }
            }
            if (lastUserIndex === -1) {
                snapshot = prev;
                return prev;
            }
            const trimmed = prev.slice(0, lastUserIndex + 1);
            snapshot = trimmed;
            return trimmed;
        });

        if (snapshot && snapshot.length) {
            sendChatRequest(snapshot);
        }
    }, [sendChatRequest]);

    const {status, type} = useUrlData({append});

    // 官网跳转进来监听 url
    useEffect(() => {
        if (status && type === "sketch") {
            showGuide();
        }
    }, [status, type]);


    useEffect(() => {
        const visibleFun = () => {
            if (isLoading) return;
            else if (!isLoading && window.electron) {
                setTimeout(() => {
                    updateFileSystemNow();
                }, 600);
            }
        };
        document.addEventListener("visibilitychange", visibleFun);
        return () => {
            document.removeEventListener("visibilitychange", visibleFun);
        };
    }, [isLoading, files]);

    useEffect(() => {
        if (errors.length > 0 && isLoading) {
            clearErrors();
        }
        if (!isLoading) {
            createMpIcon(files);
        }
    }, [errors, isLoading, clearErrors, files]);


    // 添加上传状态跟踪
    const [isUploading, setIsUploading] = useState(false);
    const filterMessages = messages.filter((e) => e.role !== "system");
    // 修改上传处理函数
    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || isUploading) return;
        setIsUploading(true);

        const selectedFiles = Array.from(e.target.files);
        const MAX_FILE_SIZE = 5 * 1024 * 1024;

        const validFiles = selectedFiles.filter((file) => {
            if (file.size > MAX_FILE_SIZE) {
                toast.error(t("chat.errors.file_size_limit", {fileName: file.name}));
                return false;
            }
            return true;
        });

        try {
            const uploadResults = await Promise.all(
                validFiles.map(async (file) => {
                    const url = await uploadImage(file);
                    return {
                        id: uuidv4(),
                        file,
                        url,
                        localUrl: URL.createObjectURL(file),
                        status: "done" as const,
                    };
                })
            );

            addImages(uploadResults);
            if (uploadResults.length === 1) {
                toast.success(t("chat.success.images_uploaded"));
            } else {
                toast.success(
                    t("chat.success.images_uploaded_multiple", {
                        count: uploadResults.length,
                    })
                );
            }
        } catch (error) {
            console.error("Upload failed:", error);
            toast.error(t("chat.errors.upload_failed"));
        } finally {
            setIsUploading(false);
        }

        e.target.value = "";
    };

    // 修改提交处理函数
    const handleSubmitWithFiles = async (
        _: React.KeyboardEvent,
        text?: string
    ) => {
        if (!text && !input.trim() && uploadedImages.length === 0) {
            console.warn("[ChatInput] 提交被忽略：内容和附件均为空");
            return;
        }

        console.log("[ChatInput] 触发提交", {
            chatMode: mode,
            hasManualText: Boolean(text),
            inputLength: (text ?? input)?.trim()?.length ?? 0,
            attachments: uploadedImages.length,
        });

        try {
            // 处理文件引用
            // const processedInput = await processFileReferences(input);
            // 如果是 ollama类型 模型 需要走单独逻辑，不走云端

            // 保存当前的图片附件
            const currentAttachments = uploadedImages.map((img) => ({
                id: img.id,
                name: img.id,
                type: img.file.type,
                localUrl: img.localUrl,
                contentType: img.file.type,
                url: img.url,
            }));

            // 先清理图片状态
            clearImages();

            append(
                {
                    role: "user",
                    content: text || input,
                },
                {
                    experimental_attachments: currentAttachments,
                }
            );
            setInput("");
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        } catch (error) {
            toast.error("Failed to upload files");
        }
    };

    // 修改键盘提交处理
    const handleKeySubmit = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmitWithFiles(e);
        }
    };

    // 修改粘贴处理函数
    const handlePaste = async (e: ClipboardEvent) => {
        if (isUploading) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const hasImages = Array.from(items).some(
            (item) => item.type.indexOf("image") !== -1
        );
        if (hasImages) {
            e.preventDefault();
            setIsUploading(true);

            const imageItems = Array.from(items).filter(
                (item) => item.type.indexOf("image") !== -1
            );

            try {
                const uploadResults = await Promise.all(
                    imageItems.map(async (item) => {
                        const file = item.getAsFile();
                        if (!file) throw new Error("Failed to get file from clipboard");

                        const url = await uploadImage(file);
                        return {
                            id: uuidv4(),
                            file,
                            url,
                            localUrl: URL.createObjectURL(file),
                            status: "done" as const,
                        };
                    })
                );

                addImages(uploadResults);

                if (uploadResults.length === 1) {
                    toast.success(t("chat.success.image_pasted"));
                } else {
                    toast.success(
                        t("chat.success.images_pasted_multiple", {
                            count: uploadResults.length,
                        })
                    );
                }
            } catch (error) {
                toast.error(t("chat.errors.paste_failed"));
            } finally {
                setIsUploading(false);
            }
        }
    };

    // 添加粘贴事件监听
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.addEventListener("paste", handlePaste);
        return () => {
            textarea.removeEventListener("paste", handlePaste);
        };
    }, []);

    // 添加拖拽处理函数
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isUploading) return;
        setIsUploading(true);

        try {
            const items = Array.from(e.dataTransfer.items);
            const imageItems = items.filter((item) => item.type.startsWith("image/"));

            const uploadResults = await Promise.all(
                imageItems.map(async (item) => {
                    const file = item.getAsFile();
                    if (!file) throw new Error("Failed to get file from drop");

                    const url = await uploadImage(file);
                    return {
                        id: uuidv4(),
                        file,
                        url,
                        localUrl: URL.createObjectURL(file),
                        status: "done" as const,
                    };
                })
            );

            addImages(uploadResults);

            if (uploadResults.length === 1) {
                toast.success("图片已添加到输入框");
            } else {
                toast.success(`${uploadResults.length} 张图片已添加到输入框`);
            }
        } catch (error) {
            toast.error("添加图片失败");
        } finally {
            setIsUploading(false);
        }
    };

    const showJsx = useMemo(() => {
        return (
            <div
                className="flex-1 overflow-y-auto px-1 py-2 message-container [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                onScroll={handleScroll}  // 添加滚动事件监听
            >
                        <Tips
            append={append}
            setInput={setInput}
            handleFileSelect={handleFileSelect}
          />
                <div className="max-w-[640px] w-full mx-auto space-y-3">
                    {filterMessages.map((message, index) => (
                        <MessageItem
                            handleRetry={() => {
                                // 测试
                                reload();
                            }}
                            key={`${message.id}-${index}`}
                            message={message}
                            isEndMessage={
                                filterMessages[filterMessages.length - 1].id === message.id
                            }
                            isLoading={isLoading}
                            onUpdateMessage={(messageId, content) => {
                                append( {
                                    role: "user",
                                    content: ` ${content?.[0]?.text}`,
                                })

                            }}
                        />
                    ))}

                    {isLoading && (
                        <div className="group" key="loading-indicator">
                            <div
                                className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                                <div
                                    className="w-6 h-6 rounded-md bg-[rgba(45,45,45)] text-gray-400 flex items-center justify-center text-xs border border-gray-700/50">
                                    <svg
                                        className="w-4 h-4 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="3"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="w-24 h-4 rounded bg-gray-700/50 animate-pulse"/>
                                        <div className="w-32 h-4 rounded bg-gray-700/50 animate-pulse"/>
                                        <div className="w-16 h-4 rounded bg-gray-700/50 animate-pulse"/>
                                    </div>
                                    <div className="mt-2 space-y-2">
                                        <div className="w-full h-3 rounded bg-gray-700/50 animate-pulse"/>
                                        <div className="w-4/5 h-3 rounded bg-gray-700/50 animate-pulse"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-px"/>
                </div>
            </div>
        );
    }, [messages, isLoading, setInput, handleFileSelect]);

    // 显示引导弹窗
    const showGuide = () => {};





    return (
        <div
            className="flex h-full flex-col dark:bg-[#18181a] max-w-full"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {showJsx}

            {/* 文件系统状态指示器 */}
            <div className="fixed top-20 right-4 z-50">
                <FileSystemStatus />
            </div>

            <ChatInput
                input={input}
                setMessages={(nextMessages) => setMessages(nextMessages as WeMessages)}
                append={append}
                messages={messages}
                stopRuning={stop}
                setInput={setInput}
                isLoading={isLoading}
                isUploading={isUploading}
                uploadedImages={uploadedImages}
                baseModal={baseModal}
                handleInputChange={handleInputChange}
                handleKeySubmit={handleKeySubmit}
                handleSubmitWithFiles={handleSubmitWithFiles}
                handleFileSelect={handleFileSelect}
                removeImage={removeImage}
                addImages={addImages}
                setIsUploading={setIsUploading}
                setBaseModal={setBaseModal}
            />
        </div>
    );
};
