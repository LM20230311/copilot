import React, { useState, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Button, Modal, message } from 'antd';
import { ChevronLeft, ChevronRight, GitMerge } from 'lucide-react';
import { Editor } from '../WeIde/components/Editor';
import { parseDiffBlocks, hasDiffContent } from '../WeIde/components/Editor/utils/diff';
import { useFileStore } from '../WeIde/stores/fileStore';

// 自定义样式，确保 Modal 内部为 flex 布局并且内容可滚动
const mergeEditorStyles = `
  .merge-editor-modal .ant-modal-content {
    padding: 0;
    height: 80vh;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .merge-editor-modal .ant-modal-body {
    padding: 0;
    flex: 1 1 auto;
    min-height: 0; /* 允许子元素使用 flex 高度约束 */
    overflow: hidden; /* 由子面板自己负责滚动 */
  }

  /* PanelGroup 和各面板占满高度，面板内部可滚动 */
  .merge-editor-modal .panel-group,
  .merge-editor-modal .panel-group > div {
    height: 100%;
    min-height: 0;
  }

  .merge-editor-modal .panel {
    height: 100%;
    min-height: 0;
    overflow: auto;
  }

  .merge-editor-modal .ant-modal-header,
  .merge-editor-modal .ant-modal-footer {
    flex: 0 0 auto;
  }

  .conflict-highlight-original {
    background: rgba(248, 215, 218, 0.6) !important;
    border-left: 3px solid #dc3545 !important;
  }

  .conflict-highlight-modified {
    background: rgba(212, 237, 218, 0.6) !important;
    border-left: 3px solid #28a745 !important;
  }

  .merge-action-button {
    transition: all 0.2s ease;
  }

  .merge-action-button:hover {
    transform: scale(1.05);
  }
`;

interface ConflictBlock {
  search: { start: number; end: number };
  replace: { start: number; end: number };
  originalText: string;
  modifiedText: string;
}

interface ThreePanelMergeEditorProps {
  originalContent: string;
  modifiedContent: string;
  onMergeComplete?: (result: string) => void;
  onCancel?: () => void;
}

const ThreePanelMergeEditor: React.FC<ThreePanelMergeEditorProps> = ({
  originalContent,
  modifiedContent,
  onMergeComplete,
  onCancel,
}) => {
  const { addFile, updateContent } = useFileStore();
  const [resultContent, setResultContent] = useState('');
  const [conflictBlocks, setConflictBlocks] = useState<ConflictBlock[]>([]);

  // 虚拟文件名
  const originalFileName = 'merge-editor-original.js';
  const modifiedFileName = 'merge-editor-modified.js';
  const resultFileName = 'merge-editor-result.js';

  // 初始化文件内容和解析冲突区块
  useEffect(() => {
    const initializeFiles = async () => {
      try {
        // 设置原始文件内容
        await addFile(originalFileName, originalContent, false);
        // 设置修改文件内容
        await addFile(modifiedFileName, modifiedContent, false);
        // 设置结果文件内容（初始为空）
        await addFile(resultFileName, '', false);

        // 解析冲突区块
        const diffContent = createDiffContent(originalContent, modifiedContent);
        const blocks = parseDiffBlocks(diffContent);
        const parsedBlocks: ConflictBlock[] = blocks.map(block => {
          const lines = diffContent.split('\n');
          const originalText = lines.slice(block.search.start + 1, block.search.end).join('\n');
          const modifiedText = lines.slice(block.search.end + 1, block.replace.end).join('\n');

          return {
            search: block.search,
            replace: block.replace,
            originalText,
            modifiedText,
          };
        });

        setConflictBlocks(parsedBlocks);
        setResultContent(''); // 初始化为空，由用户选择合并
      } catch (error) {
        console.error('初始化文件失败:', error);
        message.error('初始化文件失败');
      }
    };

    initializeFiles();
  }, [originalContent, modifiedContent, addFile]);

  // 创建diff格式的内容用于解析
  const createDiffContent = (original: string, modified: string): string => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diffContent = [];

    diffContent.push('<<<<<<< SEARCH');
    diffContent.push(...originalLines);
    diffContent.push('=======');
    diffContent.push(...modifiedLines);
    diffContent.push('>>>>>>> REPLACE');

    return diffContent.join('\n');
  };

  // 应用左侧内容（原始文件内容）
  const applyOriginalContent = async (blockIndex: number) => {
    const block = conflictBlocks[blockIndex];
    if (!block) return;

    try {
      const currentResult = resultContent;
      const lines = currentResult.split('\n');
      const newLines = [...lines];

      // 如果结果为空，直接设置内容；否则追加
      if (currentResult.trim() === '') {
        const newContent = block.originalText;
        await updateContent(resultFileName, newContent);
        setResultContent(newContent);
      } else {
        // 在结果末尾追加内容
        const newContent = currentResult + '\n' + block.originalText;
        await updateContent(resultFileName, newContent);
        setResultContent(newContent);
      }

      message.success('已应用原始文件内容');
    } catch (error) {
      console.error('应用原始内容失败:', error);
      message.error('应用原始内容失败');
    }
  };

  // 应用右侧内容（新文件内容）
  const applyModifiedContent = async (blockIndex: number) => {
    const block = conflictBlocks[blockIndex];
    if (!block) return;

    try {
      const currentResult = resultContent;

      // 如果结果为空，直接设置内容；否则追加
      if (currentResult.trim() === '') {
        const newContent = block.modifiedText;
        await updateContent(resultFileName, newContent);
        setResultContent(newContent);
      } else {
        // 在结果末尾追加内容
        const newContent = currentResult + '\n' + block.modifiedText;
        await updateContent(resultFileName, newContent);
        setResultContent(newContent);
      }

      message.success('已应用新文件内容');
    } catch (error) {
      console.error('应用新文件内容失败:', error);
      message.error('应用新文件内容失败');
    }
  };

  // 完成合并
  const handleComplete = () => {
    if (onMergeComplete) {
      // 从文件存储中获取最新的结果内容
      const { getContent } = useFileStore.getState();
      const finalResult = getContent(resultFileName) || resultContent;
      onMergeComplete(finalResult);
    }
    message.success('合并完成！');
  };

  // 取消操作
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <GitMerge className="w-5 h-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            文件冲突解决
          </h3>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleComplete}>
            完成合并
          </Button>
        </div>
      </div>

      {/* 三栏布局 */}
      <div className="flex-1 min-h-0">
        <PanelGroup direction="horizontal" className="panel-group h-full">
          {/* 左侧面板 - 原始文件 */}
          <Panel defaultSize={33} minSize={25} className="panel">
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  原始文件
                </h4>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0">
                  <Editor
                    fileName={originalFileName}
                    initialLine={1}
                  />
                </div>
                {/* 冲突区块高亮和操作按钮 */}
                {conflictBlocks.map((block, index) => {
                  const startLine = block.search.start + 1;
                  const endLine = block.search.end - 1;
                  const blockHeight = Math.max(20, (endLine - startLine + 1) * 20);

                  return (
                    <div key={`original-${index}`}>
                      {/* 冲突区块高亮背景 */}
                      <div
                        className="absolute left-0 right-0 bg-red-100 dark:bg-red-900/30 border-l-4 border-red-400 pointer-events-none z-5"
                        style={{
                          top: `${startLine * 20}px`,
                          height: `${blockHeight}px`,
                        }}
                      />
                      {/* 操作按钮 */}
                      <div
                        className="absolute right-2 merge-action-button z-10"
                        style={{
                          top: `${startLine * 20 + blockHeight / 2 - 12}px`, // 垂直居中
                        }}
                      >
                        <Button
                          size="small"
                          type="primary"
                          danger
                          icon={<ChevronRight className="w-3 h-3" />}
                          onClick={() => applyOriginalContent(index)}
                          className="shadow-md"
                          title="应用原始文件内容到结果"
                        >
                          应用
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" />

          {/* 中间面板 - 合并结果 */}
          <Panel defaultSize={34} minSize={25} className="panel">
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900 border-b border-blue-200 dark:border-blue-700">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  合并结果
                </h4>
              </div>
              <div className="flex-1">
                <Editor
                  fileName={resultFileName}
                  initialLine={1}
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" />

          {/* 右侧面板 - 新文件 */}
          <Panel defaultSize={33} minSize={25} className="panel">
            <div className="h-full flex flex-col">
              <div className="px-3 py-2 bg-green-50 dark:bg-green-900 border-b border-green-200 dark:border-green-700">
                <h4 className="text-sm font-medium text-green-700 dark:text-green-300">
                  新文件
                </h4>
              </div>
              <div className="flex-1 relative">
                <div className="absolute inset-0">
                  <Editor
                    fileName={modifiedFileName}
                    initialLine={1}
                  />
                </div>
                {/* 冲突区块高亮和操作按钮 */}
                {conflictBlocks.map((block, index) => {
                  const startLine = block.replace.start + 1;
                  const endLine = block.replace.end - 1;
                  const blockHeight = Math.max(20, (endLine - startLine + 1) * 20);

                  return (
                    <div key={`modified-${index}`}>
                      {/* 冲突区块高亮背景 */}
                      <div
                        className="absolute left-0 right-0 bg-green-100 dark:bg-green-900/30 border-l-4 border-green-400 pointer-events-none z-5"
                        style={{
                          top: `${startLine * 20}px`,
                          height: `${blockHeight}px`,
                        }}
                      />
                      {/* 操作按钮 */}
                      <div
                        className="absolute left-2 merge-action-button z-10"
                        style={{
                          top: `${startLine * 20 + blockHeight / 2 - 12}px`, // 垂直居中
                        }}
                      >
                        <Button
                          size="small"
                          type="primary"
                          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                          icon={<ChevronLeft className="w-3 h-3" />}
                          onClick={() => applyModifiedContent(index)}
                          className="shadow-md hover:bg-green-600"
                          title="应用新文件内容到结果"
                        >
                          应用
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
};

// 测试弹窗组件
interface MergeEditorModalProps {
  open: boolean;
  onClose: () => void;
}

export const MergeEditorModal: React.FC<MergeEditorModalProps> = ({ open, onClose }) => {
  // 注入自定义样式
  useEffect(() => {
    if (open) {
      const styleElement = document.createElement('style');
      styleElement.textContent = mergeEditorStyles;
      document.head.appendChild(styleElement);

      return () => {
        document.head.removeChild(styleElement);
      };
    }
  }, [open]);

  // 测试数据 - 简单的代码冲突示例
  const testOriginalContent = `function calculatePrice(items) {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

function displayCart(items) {
  const totalPrice = calculatePrice(items);
  console.log('Total price: $' + totalPrice);
  return totalPrice;
}`;

  const testModifiedContent = `function calculatePrice(items) {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
    // Apply item discount if available
    if (item.discount) {
      total -= item.discount;
    }
  }
  return Math.max(0, total);
}

function displayCart(items) {
  const totalPrice = calculatePrice(items);
  const discount = 10; // Fixed discount
  const finalPrice = Math.max(0, totalPrice - discount);

  console.log('Total price: $' + totalPrice);
  console.log('Discount: $' + discount);
  console.log('Final price: $' + finalPrice);

  return finalPrice;
}`;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      height="80vh"
      centered
      destroyOnClose
      className="merge-editor-modal"
    >
      <ThreePanelMergeEditor
        originalContent={testOriginalContent}
        modifiedContent={testModifiedContent}
        onMergeComplete={(result) => {
          console.log('Merge result:', result);
          message.success('合并完成！');
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
};

export default ThreePanelMergeEditor;
