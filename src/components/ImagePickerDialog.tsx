import React, { useEffect, useState } from 'react';
import { BUILTIN_IMAGES } from '../logic/builtinCards';

interface ImagePickerDialogProps {
  current?: string;
  onPick: (image: string | undefined) => void;
  onClose: () => void;
}

const MAX_WIDTH = 400;
const MAX_HEIGHT = 300;

// アップロードした画像を小さくして（ブラウザに保存できる大きさにして）data URL にする
const shrinkImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const scale = Math.min(1, MAX_WIDTH / img.width, MAX_HEIGHT / img.height);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('canvas'));
          return;
        }
        context.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

const ImagePickerDialog: React.FC<ImagePickerDialogProps> = ({ current, onPick, onClose }) => {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('画像ファイル（PNG・JPEG など）を選んでください。');
      return;
    }
    try {
      onPick(await shrinkImage(file));
    } catch {
      setError('この画像は読み込めませんでした。別の画像を選んでください。');
    }
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog image-picker" role="dialog" aria-modal="true" aria-label="イラストを選ぶ" onClick={e => e.stopPropagation()}>
        <h2 className="panel-title">イラストを選ぶ</h2>
        <div className="image-grid">
          {BUILTIN_IMAGES.map(image => (
            <button
              key={image.fileName}
              type="button"
              className={`image-choice ${current === image.url ? 'selected' : ''}`}
              onClick={() => onPick(image.url)}
              aria-label={image.fileName}
            >
              <img src={image.url} alt="" />
            </button>
          ))}
        </div>
        <div className="image-picker-actions">
          <label className="secondary-button file-button">
            画像をアップロード
            <input type="file" accept="image/*" onChange={e => handleFile(e.target.files?.[0])} />
          </label>
          <button type="button" className="text-button" onClick={() => onPick(undefined)}>絵なしにする</button>
          <button type="button" className="text-button" onClick={onClose}>閉じる</button>
        </div>
        <p className="step-hint">アップロードした画像は縮小して、このブラウザに保存されます。</p>
        {error && <p className="deck-error">{error}</p>}
      </div>
    </div>
  );
};

export default ImagePickerDialog;
