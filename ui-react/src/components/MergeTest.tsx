import React, { useEffect, useRef, useState } from 'react';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { MergeView } from '@codemirror/merge';
import { javascript } from '@codemirror/lang-javascript';

interface MergeTestProps {
  originalCode: string;
  modifiedCode: string;
  className?: string;
}

export const MergeTest: React.FC<MergeTestProps> = ({
  originalCode,
  modifiedCode,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<any | null>(null);
  const [mergedText, setMergedText] = useState<string>('');

  useEffect(() => {
    if (!containerRef.current) return;

    // 清理之前的实例
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
    }

    // 创建merge view（使用 minimal extensions）
    const extensions = [javascript()];

    mergeViewRef.current = new MergeView({
      a: { doc: originalCode, extensions },
      b: { doc: modifiedCode, extensions },
      // `merge` creates the middle (merged) pane
      merge: { doc: modifiedCode, extensions },
      parent: containerRef.current,
      // 显示两侧方向的控制箭头（每个差异块上）
      revertControls: 'both',
      // 恢复为左右箭头的样式（之前的样式）
      renderRevertControl: (_chunk: any, side?: string) => {
        const button = document.createElement('button');
        button.textContent = side === 'a' ? '←' : '→';
        button.title = side === 'a' ? '应用左侧变更到中间' : '应用右侧变更到中间';
        button.className = 'px-2 py-0.5 bg-gray-100 border rounded text-xs hover:bg-gray-200';
        return button;
      },
    } as any);

    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
    };
  }, [originalCode, modifiedCode]);

  // Try to read merged content from the middle editor (DOM fallback).
  const handleApply = () => {
    if (!containerRef.current) return;
    // CodeMirror editors rendered inside the container usually have class 'cm-editor'.
    const editors = containerRef.current.querySelectorAll('.cm-editor');
    // Expect three editors: left, middle (merged), right
    if (editors && editors.length >= 3) {
      const middle = editors[Math.floor(editors.length / 2)];
      // The editable text is under '.cm-content'
      const contentNode = middle.querySelector('.cm-content');
      const text = contentNode ? contentNode.textContent || '' : '';
      setMergedText(text);
      // For now just log — replace with any apply logic you need.
      console.log('Applied merged content:', text);
      return;
    }

    // Fallback: try to read from mergeView instance if available
    try {
      // Some MergeView builds expose the merged editor state at `mergeViewRef.current.merge`
      const mergedState = (mergeViewRef.current as any)?.merge?.state;
      const text = mergedState ? mergedState.doc.toString() : '';
      setMergedText(text);
      console.log('Applied merged content (from state):', text);
    } catch (e) {
      console.warn('Failed to read merged content', e);
    }
  };

  return (
    <div className={`merge-test-container ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">版本对比测试</h3>
        <div className="text-sm text-gray-600">
          <p>左侧：原始版本 | 中间：合并结果 | 右侧：修改版本</p>
        </div>
      </div>
      <div
        ref={containerRef}
        className="border rounded-lg overflow-hidden"
        style={{ height: '400px' }}
      />
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={handleApply}
          className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
        >
          应用合并结果
        </button>
        <div className="text-xs text-gray-500">已应用文本长度：{mergedText.length}</div>
      </div>

      
      <div className="mt-4 text-xs text-gray-500">
        <p>点击中间面板可以编辑合并结果，点击Revert按钮可以恢复原始内容</p>
      </div>
    </div>
  );
};

// 默认测试数据
export const MergeTestDefault: React.FC = () => {
  const originalCode = `function calculateTotal(items) {
  let total = 0;
  for (let item of items) {
    total += item.price * item.quantity;
  }
  return total;
}

console.log('Hello World');`;

  const modifiedCode = `function calculateTotal(items) {
  let total = 0;
  const discount = 0.1;

  for (let item of items) {
    if (item.category === 'electronics') {
      total += item.price * item.quantity * (1 - discount);
    } else {
      total += item.price * item.quantity;
    }
  }

  // 添加税费计算
  const tax = total * 0.08;
  total += tax;

  return Math.round(total * 100) / 100;
}

console.log('Updated calculation with discount and tax');`;

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <MergeTest originalCode={originalCode} modifiedCode={modifiedCode} />
    </div>
  );
};
