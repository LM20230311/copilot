import React from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer';
import { X } from 'lucide-react';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 示例代码数据
const oldCode = `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price * items[i].quantity;
  }
  return total;
}

function formatCurrency(amount) {
  return '$' + amount.toFixed(2);
}

const user = {
  name: 'John Doe',
  age: 30,
  email: 'john@example.com'
};`;

const newCode = `function calculateTotal(items) {
  if (!items || !Array.isArray(items)) {
    throw new Error('Invalid items array');
  }

  return items.reduce((total, item) => {
    if (!item.price || !item.quantity) {
      throw new Error('Invalid item structure');
    }
    return total + (item.price * item.quantity);
  }, 0);
}

function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error('Invalid amount');
  }
  return '$' + amount.toFixed(2);
}

const user = {
  name: 'John Doe',
  age: 30,
  email: 'john.doe@example.com',
  role: 'admin'
};`;

export function DiffViewerModal({ isOpen, onClose }: DiffViewerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            代码差分查看器 (react-diff-viewer)
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              左侧显示原始代码，右侧显示新代码。绿色表示新增，红色表示删除。
            </p>
          </div>

          <ReactDiffViewer
            oldValue={oldCode}
            newValue={newCode}
            splitView={true}
            compareMethod={DiffMethod.WORDS}
            useDarkTheme={false}
            leftTitle="原始文件"
            rightTitle="修改后的文件"
            disableWordDiff={false}
            hideLineNumbers={false}
            showDiffOnly={false}
            renderContent={(str) => (
              <pre
                style={{
                  display: 'inline',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}
              >
                {str}
              </pre>
            )}
            styles={{
              diffContainer: {
                fontSize: '14px',
                lineHeight: '1.5',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace'
              },
              diffRemoved: {
                backgroundColor: 'rgba(255, 0, 0, 0.1)',
                color: '#ff6b6b'
              },
              diffAdded: {
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                color: '#51cf66'
              },
              line: {
                padding: '4px 8px'
              },
              gutter: {
                padding: '4px 8px',
                minWidth: '40px'
              },
              marker: {
                padding: '4px 8px'
              }
            }}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
