// 파일 처리 핸들러

const FileHandler = {
  // 파일 유효성 검사
  validateFile(file) {
    // 크기 확인
    if (file.size > window.CONFIG.MAX_FILE_SIZE) {
      throw new Error(`파일 크기는 ${Utils.formatFileSize(window.CONFIG.MAX_FILE_SIZE)} 이하여야 합니다.`);
    }
    
    // 타입 확인
    const allowedTypes = [
      ...window.CONFIG.ALLOWED_IMAGE_TYPES,
      ...window.CONFIG.ALLOWED_DOCUMENT_TYPES
    ];
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('지원하지 않는 파일 형식입니다. (지원: JPG, PNG, PDF, TXT)');
    }
    
    return true;
  },
  
  // 파일을 Base64로 변환
  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]; // data:... 부분 제거
        resolve(base64);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsDataURL(file);
    });
  },
  
  // 텍스트 파일 읽기
  async readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        resolve(reader.result);
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  },
  
  // 파일 타입 결정
  getFileType(file) {
    if (window.CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return 'image';
    }
    if (file.type === 'application/pdf') {
      return 'pdf';
    }
    if (file.type === 'text/plain') {
      return 'text';
    }
    return 'unknown';
  },
  
  // 파일 처리 (타입에 따라)
  async processFile(file) {
    try {
      this.validateFile(file);
      
      const fileType = this.getFileType(file);
      let content = null;
      
      if (fileType === 'image' || fileType === 'pdf') {
        // 이미지나 PDF는 Base64로 변환
        content = await this.fileToBase64(file);
      } else if (fileType === 'text') {
        // 텍스트는 직접 읽기
        content = await this.readTextFile(file);
      }
      
      return {
        name: file.name,
        type: fileType,
        mimeType: file.type,
        size: file.size,
        content
      };
    } catch (error) {
      console.error('File processing error:', error);
      throw error;
    }
  },
  
  // Supabase Storage에 업로드
  async uploadToStorage(file, bucket = 'quiz-files') {
    try {
      // 파일명 중복 방지를 위한 고유 이름 생성
      const timestamp = Date.now();
      const randomStr = Utils.generateId();
      const extension = Utils.getFileExtension(file.name);
      const fileName = `${timestamp}-${randomStr}.${extension}`;
      const filePath = `uploads/${fileName}`;
      
      // 업로드
      const result = await DB.storage.upload(bucket, filePath, file);
      
      return {
        originalName: file.name,
        storagePath: result.path,
        url: result.url,
        size: file.size,
        type: this.getFileType(file)
      };
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },
  
  // 파일 미리보기 URL 생성
  createPreviewUrl(file) {
    return URL.createObjectURL(file);
  },
  
  // 미리보기 URL 해제
  revokePreviewUrl(url) {
    URL.revokeObjectURL(url);
  },
  
  // 파일 다운로드
  downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
  
  // 텍스트를 파일로 다운로드
  downloadTextAsFile(text, filename, type = 'text/plain') {
    const blob = new Blob([text], { type });
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, filename);
    URL.revokeObjectURL(url);
  },
  
  // JSON을 파일로 다운로드
  downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    this.downloadTextAsFile(json, filename, 'application/json');
  }
};

// 파일 업로드 UI 컴포넌트
class FileUploadComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      maxFiles: options.maxFiles || 1,
      accept: options.accept || 'image/*,.pdf,.txt',
      onFileSelect: options.onFileSelect || (() => {}),
      onFileRemove: options.onFileRemove || (() => {}),
      showPreview: options.showPreview !== false
    };
    this.files = [];
    this.init();
  }
  
  init() {
    this.render();
    this.attachEvents();
  }
  
  render() {
    this.container.innerHTML = `
      <div class="file-upload-area">
        <input 
          type="file" 
          id="${this.container.id}-input" 
          class="file-input" 
          accept="${this.options.accept}"
          ${this.options.maxFiles > 1 ? 'multiple' : ''}
          style="display: none;"
        />
        <label for="${this.container.id}-input" class="file-upload-label">
          <div class="upload-icon">📁</div>
          <div class="upload-text">
            <p>파일을 선택하거나 드래그하세요</p>
            <p class="upload-hint">지원 형식: JPG, PNG, PDF, TXT (최대 ${Utils.formatFileSize(window.CONFIG.MAX_FILE_SIZE)})</p>
          </div>
        </label>
        <div id="${this.container.id}-preview" class="file-preview-area"></div>
      </div>
    `;
  }
  
  attachEvents() {
    const input = this.container.querySelector('.file-input');
    const uploadArea = this.container.querySelector('.file-upload-area');
    
    // 파일 선택
    input.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });
    
    // 드래그 앤 드롭
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  }
  
  async handleFiles(fileList) {
    try {
      const filesArray = Array.from(fileList);
      
      // 파일 개수 확인
      if (this.options.maxFiles === 1 && filesArray.length > 1) {
        Utils.showToast('파일은 하나만 선택할 수 있습니다.', 'warning');
        return;
      }
      
      if (filesArray.length > this.options.maxFiles) {
        Utils.showToast(`최대 ${this.options.maxFiles}개까지 선택할 수 있습니다.`, 'warning');
        return;
      }
      
      // 파일 처리
      for (const file of filesArray) {
        try {
          const processedFile = await FileHandler.processFile(file);
          this.files.push({
            raw: file,
            processed: processedFile
          });
          
          if (this.options.showPreview) {
            this.addPreview(file, processedFile);
          }
          
          this.options.onFileSelect(processedFile, file);
        } catch (error) {
          Utils.showToast(error.message, 'error');
        }
      }
    } catch (error) {
      Utils.handleError(error, '파일 처리 중 오류가 발생했습니다.');
    }
  }
  
  addPreview(file, processedFile) {
    const previewArea = this.container.querySelector('.file-preview-area');
    const previewId = `preview-${Utils.generateId()}`;
    
    const previewHtml = `
      <div class="file-preview-item" id="${previewId}">
        ${processedFile.type === 'image' ? 
          `<img src="${FileHandler.createPreviewUrl(file)}" alt="${file.name}" class="preview-image" />` :
          `<div class="preview-file-icon">📄</div>`
        }
        <div class="preview-info">
          <p class="preview-filename">${file.name}</p>
          <p class="preview-filesize">${Utils.formatFileSize(file.size)}</p>
        </div>
        <button class="preview-remove-btn" data-preview-id="${previewId}">✕</button>
      </div>
    `;
    
    previewArea.insertAdjacentHTML('beforeend', previewHtml);
    
    // 삭제 버튼 이벤트
    const removeBtn = previewArea.querySelector(`[data-preview-id="${previewId}"]`);
    removeBtn.addEventListener('click', () => {
      this.removeFile(previewId, file);
    });
  }
  
  removeFile(previewId, file) {
    // 배열에서 제거
    this.files = this.files.filter(f => f.raw !== file);
    
    // 미리보기 제거
    const previewElement = document.getElementById(previewId);
    if (previewElement) {
      previewElement.remove();
    }
    
    this.options.onFileRemove(file);
  }
  
  getFiles() {
    return this.files;
  }
  
  clear() {
    this.files = [];
    const previewArea = this.container.querySelector('.file-preview-area');
    previewArea.innerHTML = '';
  }
}

// 전역으로 export
window.FileHandler = FileHandler;
window.FileUploadComponent = FileUploadComponent;
