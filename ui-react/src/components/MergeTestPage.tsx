import React, { useState } from 'react';
import { MergeTest, MergeTestDefault } from './MergeTest';

const MergeTestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default');

  const [customOriginal, setCustomOriginal] = useState(`function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10));`);

  const [customModified, setCustomModified] = useState(`function fibonacci(n) {
  // 使用记忆化优化
  const memo = new Map();

  function fib(n) {
    if (n <= 1) return n;
    if (memo.has(n)) return memo.get(n);

    const result = fib(n - 1) + fib(n - 2);
    memo.set(n, result);
    return result;
  }

  return fib(n);
}

console.log(fibonacci(10));`);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            @codemirror/merge 测试页面
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            测试CodeMirror的merge功能，用于实现类似git合并冲突的编辑功能
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('default')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'default'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                默认示例
              </button>
              <button
                onClick={() => setActiveTab('custom')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'custom'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                自定义测试
              </button>
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'default' && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                默认示例 - 购物车计算函数版本对比
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                展示添加折扣和税费计算功能的版本差异
              </p>
            </div>
            <MergeTestDefault />
          </div>
        )}

        {activeTab === 'custom' && (
          <div>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                自定义测试 - 斐波那契函数优化
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                对比递归实现和记忆化优化的版本
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Original Code Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  原始版本
                </label>
                <textarea
                  value={customOriginal}
                  onChange={(e) => setCustomOriginal(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入原始版本的代码..."
                />
              </div>

              {/* Modified Code Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  修改版本
                </label>
                <textarea
                  value={customModified}
                  onChange={(e) => setCustomModified(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="输入修改版本的代码..."
                />
              </div>
            </div>

            {/* Merge View */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                版本对比结果
              </h3>
              <MergeTest originalCode={customOriginal} modifiedCode={customModified} />
            </div>
          </div>
        )}

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            使用说明
          </h3>
          <div className="text-blue-800 dark:text-blue-200 space-y-2">
            <p><strong>三面板布局：</strong>左侧显示原始版本，中间是可编辑的合并结果，右侧显示修改版本</p>
            <p><strong>交互功能：</strong>点击中间面板可以在合并结果中进行编辑</p>
            <p><strong>Revert按钮：</strong>点击可以恢复到原始版本的内容</p>
            <p><strong>语法高亮：</strong>支持JavaScript语法高亮和暗色主题</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MergeTestPage;
