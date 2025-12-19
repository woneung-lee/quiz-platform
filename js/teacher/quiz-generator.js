// 퀴즈 생성기

const QuizGenerator = {
  teacherId: null,
  subjectId: null,
  subject: null,
  fileUploadComponent: null,
  uploadedFile: null,
  generatedQuestions: [],
  currentStep: 1,
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    // URL에서 subjectId 가져오기
    const params = Utils.getQueryParams();
    this.subjectId = params.subjectId;
    
    if (!this.subjectId) {
      Utils.showToast('과목을 선택해주세요.', 'warning');
      window.location.href = '/teacher/subjects.html';
      return;
    }
    
    try {
      await this.loadSubject();
      this.setupFileUpload();
      this.setupEventListeners();
    } catch (error) {
      console.error('Quiz generator initialization error:', error);
      Utils.handleError(error, '퀴즈 생성기 초기화 중 오류가 발생했습니다.');
    }
  },
  
  // 과목 정보 로드
  async loadSubject() {
    try {
      this.subject = await DB.subjects.getById(this.subjectId);
      
      // 과목 정보 표시
      document.getElementById('subject-name-display').textContent = this.subject.name;
      const iconDisplay = document.getElementById('subject-icon-display');
      iconDisplay.textContent = this.subject.icon || '📚';
      iconDisplay.style.backgroundColor = this.subject.color || '#4F46E5';
      iconDisplay.style.color = 'white';
      
    } catch (error) {
      console.error('Subject loading error:', error);
      throw error;
    }
  },
  
  // 파일 업로드 설정
  setupFileUpload() {
    this.fileUploadComponent = new FileUploadComponent('file-upload-container', {
      maxFiles: 1,
      accept: 'image/*,.pdf,.txt',
      showPreview: true,
      onFileSelect: (processedFile, rawFile) => {
        this.uploadedFile = processedFile;
        console.log('File uploaded:', processedFile);
      },
      onFileRemove: (file) => {
        this.uploadedFile = null;
        console.log('File removed');
      }
    });
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    // Step 1 -> Step 2
    document.getElementById('goto-step-2').addEventListener('click', () => {
      if (this.validateStep1()) {
        this.goToStep(2);
      }
    });
    
    // Step 2 -> Step 1
    document.getElementById('back-to-step-1').addEventListener('click', () => {
      this.goToStep(1);
    });
    
    // Step 2 -> Step 3
    document.getElementById('goto-step-3').addEventListener('click', () => {
      this.goToStep(3);
      this.renderQuestionsPreview();
    });
    
    // Step 3 -> Step 2
    document.getElementById('back-to-step-2').addEventListener('click', () => {
      this.goToStep(2);
    });
    
    // AI 문제 생성
    document.getElementById('generate-btn').addEventListener('click', async () => {
      await this.generateQuestions();
    });
    
    // 재시도
    document.getElementById('retry-btn').addEventListener('click', async () => {
      await this.generateQuestions();
    });
    
    // 퀴즈 저장
    document.getElementById('save-quiz-btn').addEventListener('click', async () => {
      await this.saveQuiz();
    });
  },
  
  // Step 1 유효성 검사
  validateStep1() {
    const title = document.getElementById('quiz-title').value.trim();
    const questionCount = parseInt(document.getElementById('question-count').value);
    const prompt = document.getElementById('quiz-prompt').value.trim();
    
    if (!title) {
      Utils.showToast('퀴즈 제목을 입력해주세요.', 'warning');
      return false;
    }
    
    if (questionCount < 5 || questionCount > 50) {
      Utils.showToast('문제 개수는 5~50개 사이여야 합니다.', 'warning');
      return false;
    }
    
    if (!prompt) {
      Utils.showToast('문제 생성 지시사항을 입력해주세요.', 'warning');
      return false;
    }
    
    return true;
  },
  
  // 단계 이동
  goToStep(step) {
    // 모든 단계 숨기기
    document.querySelectorAll('.step-content').forEach(el => {
      el.style.display = 'none';
    });
    
    // 선택한 단계 표시
    document.getElementById(`step-${step}-content`).style.display = 'block';
    
    // 단계 표시 업데이트
    document.querySelectorAll('.step').forEach((el, index) => {
      el.classList.remove('active', 'completed');
      if (index + 1 < step) {
        el.classList.add('completed');
      } else if (index + 1 === step) {
        el.classList.add('active');
      }
    });
    
    this.currentStep = step;
    
    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
  
  // AI 문제 생성
  async generateQuestions() {
    const gotoStep3Btn = document.getElementById('goto-step-3');
    
    // UI 초기화
    document.getElementById('generation-status').style.display = 'none';
    document.getElementById('generation-progress').style.display = 'block';
    document.getElementById('generation-result').style.display = 'none';
    document.getElementById('generation-error').style.display = 'none';
    gotoStep3Btn.style.display = 'none';
    
    try {
      // 프로그레스 바 시작
      this.updateProgress(10, '문제 생성 요청 중...');
      
      const questionCount = parseInt(document.getElementById('question-count').value);
      const choiceCount = parseInt(document.getElementById('choice-count').value);
      const prompt = document.getElementById('quiz-prompt').value.trim();
      
      let fileContent = null;
      let fileType = null;
      
      // 파일이 업로드된 경우
      if (this.uploadedFile) {
        this.updateProgress(20, '파일 처리 중...');
        fileContent = this.uploadedFile.content;
        fileType = this.uploadedFile.type;
      }
      
      this.updateProgress(30, 'AI가 문제를 생성하고 있습니다...');
      
      // OpenAI API 호출
      const questions = await OpenAIClient.generateQuiz({
        prompt,
        fileContent,
        fileType,
        questionCount,
        choiceCount
      });
      
      this.updateProgress(80, '문제 검증 중...');
      
      // 생성된 문제 저장
      this.generatedQuestions = questions;
      
      this.updateProgress(100, '완료!');
      
      // 성공 UI
      setTimeout(() => {
        document.getElementById('generation-progress').style.display = 'none';
        document.getElementById('generation-result').style.display = 'block';
        gotoStep3Btn.style.display = 'inline-flex';
      }, 500);
      
    } catch (error) {
      console.error('Question generation error:', error);
      
      // 에러 UI
      document.getElementById('generation-progress').style.display = 'none';
      document.getElementById('generation-error').style.display = 'block';
      document.getElementById('error-message').textContent = error.message || '알 수 없는 오류가 발생했습니다.';
    }
  },
  
  // 프로그레스 바 업데이트
  updateProgress(percentage, text) {
    document.getElementById('progress-bar').style.width = `${percentage}%`;
    document.getElementById('progress-text').textContent = `${percentage}% - ${text}`;
  },
  
  // 문제 미리보기 렌더링
  renderQuestionsPreview() {
    const container = document.getElementById('questions-preview-container');
    document.getElementById('quiz-question-count-display').textContent = 
      `총 ${this.generatedQuestions.length}개 문제`;
    
    // 선택지 번호 매핑
    const choiceLabels = ['①', '②', '③', '④', '⑤'];
    
    let html = '';
    
    this.generatedQuestions.forEach((question, index) => {
      html += `
        <div class="question-preview-card" data-question-index="${index}">
          <div class="question-preview-header">
            <span class="question-number">문제 ${index + 1}</span>
            <button class="btn-icon" onclick="QuizGenerator.editQuestion(${index})" title="수정">
              ✏️
            </button>
          </div>
          
          <div class="question-content">
            <div class="question-text editable" data-field="question">${Utils.escapeHtml(question.question)}</div>
            
            <div class="choices-list">
              ${question.choices.map((choice, choiceIndex) => `
                <div class="choice-item ${choiceIndex === question.correctAnswer ? 'correct' : ''}" data-choice-index="${choiceIndex}">
                  <span class="choice-label">${choiceLabels[choiceIndex] || `${choiceIndex + 1}`}</span>
                  <span class="choice-text editable" data-field="choice">${Utils.escapeHtml(choice)}</span>
                  <button class="choice-check-btn ${choiceIndex === question.correctAnswer ? 'active' : ''}" 
                          onclick="QuizGenerator.setCorrectAnswer(${index}, ${choiceIndex})"
                          title="정답으로 설정">
                    ${choiceIndex === question.correctAnswer ? '✓ 정답' : '정답 설정'}
                  </button>
                </div>
              `).join('')}
            </div>
            
            <div class="explanation-section">
              <div class="explanation-label">해설</div>
              <div class="explanation-text editable" data-field="explanation">${Utils.escapeHtml(question.explanation)}</div>
            </div>
          </div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    
    // 수정 가능한 요소에 클릭 이벤트 추가
    this.setupEditableElements();
  },
  
  // 수정 가능한 요소 설정
  setupEditableElements() {
    document.querySelectorAll('.editable').forEach(element => {
      element.addEventListener('click', (e) => {
        if (element.querySelector('textarea') || element.querySelector('input')) {
          return; // 이미 편집 중
        }
        
        const questionCard = element.closest('.question-preview-card');
        const questionIndex = parseInt(questionCard.dataset.questionIndex);
        const field = element.dataset.field;
        const originalText = element.textContent;
        
        // 편집 UI 생성
        let editElement;
        if (field === 'question' || field === 'explanation') {
          editElement = document.createElement('textarea');
          editElement.className = 'edit-textarea';
          editElement.value = originalText;
          editElement.rows = field === 'question' ? 3 : 4;
        } else {
          editElement = document.createElement('input');
          editElement.type = 'text';
          editElement.className = 'edit-input';
          editElement.value = originalText;
        }
        
        element.innerHTML = '';
        element.appendChild(editElement);
        editElement.focus();
        
        // 저장 함수
        const saveEdit = () => {
          const newValue = editElement.value.trim();
          
          if (!newValue) {
            Utils.showToast('내용을 입력해주세요.', 'warning');
            editElement.focus();
            return;
          }
          
          // 데이터 업데이트
          if (field === 'question') {
            this.generatedQuestions[questionIndex].question = newValue;
          } else if (field === 'explanation') {
            this.generatedQuestions[questionIndex].explanation = newValue;
          } else if (field === 'choice') {
            const choiceIndex = parseInt(questionCard.querySelectorAll('.choice-item')[
              Array.from(element.closest('.choice-item').parentElement.children).indexOf(element.closest('.choice-item'))
            ].dataset.choiceIndex);
            this.generatedQuestions[questionIndex].choices[choiceIndex] = newValue;
          }
          
          // UI 업데이트
          element.textContent = newValue;
          Utils.showToast('저장되었습니다.', 'success');
        };
        
        // Enter로 저장 (Shift+Enter는 줄바꿈)
        editElement.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
          } else if (e.key === 'Escape') {
            element.textContent = originalText;
          }
        });
        
        // 포커스 잃으면 저장
        editElement.addEventListener('blur', saveEdit);
      });
    });
  },
  
  // 문제 수정 모달 (더 큰 편집 필요시)
  editQuestion(index) {
    const question = this.generatedQuestions[index];
    
    const modal = `
      <div class="modal active" id="edit-question-modal">
        <div class="modal-content" style="max-width: 800px;">
          <div class="modal-header">
            <h2>문제 ${index + 1} 수정</h2>
            <button class="modal-close" onclick="Utils.modal.hide('edit-question-modal')">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">문제</label>
              <textarea id="edit-question-text" class="form-input" rows="4">${Utils.escapeHtml(question.question)}</textarea>
            </div>
            
            <div class="form-group">
              <label class="form-label">선택지</label>
              ${question.choices.map((choice, choiceIndex) => `
                <div class="mb-sm">
                  <input type="text" class="form-input" id="edit-choice-${choiceIndex}" value="${Utils.escapeHtml(choice)}">
                </div>
              `).join('')}
            </div>
            
            <div class="form-group">
              <label class="form-label">정답</label>
              <select id="edit-correct-answer" class="form-select">
                ${question.choices.map((choice, choiceIndex) => `
                  <option value="${choiceIndex}" ${choiceIndex === question.correctAnswer ? 'selected' : ''}>
                    ${choiceIndex + 1}번: ${Utils.escapeHtml(choice.substring(0, 30))}${choice.length > 30 ? '...' : ''}
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label class="form-label">해설</label>
              <textarea id="edit-explanation" class="form-input" rows="4">${Utils.escapeHtml(question.explanation)}</textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="Utils.modal.hide('edit-question-modal')">취소</button>
            <button class="btn btn-primary" onclick="QuizGenerator.saveQuestionEdit(${index})">저장</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
  },
  
  // 문제 수정 저장
  saveQuestionEdit(index) {
    const questionText = document.getElementById('edit-question-text').value.trim();
    const choices = [];
    
    for (let i = 0; i < this.generatedQuestions[index].choices.length; i++) {
      const choiceValue = document.getElementById(`edit-choice-${i}`).value.trim();
      if (!choiceValue) {
        Utils.showToast(`${i + 1}번 선택지를 입력해주세요.`, 'warning');
        return;
      }
      choices.push(choiceValue);
    }
    
    const correctAnswer = parseInt(document.getElementById('edit-correct-answer').value);
    const explanation = document.getElementById('edit-explanation').value.trim();
    
    if (!questionText) {
      Utils.showToast('문제를 입력해주세요.', 'warning');
      return;
    }
    
    if (!explanation) {
      Utils.showToast('해설을 입력해주세요.', 'warning');
      return;
    }
    
    // 데이터 업데이트
    this.generatedQuestions[index] = {
      question: questionText,
      choices: choices,
      correctAnswer: correctAnswer,
      explanation: explanation
    };
    
    // UI 업데이트
    this.renderQuestionsPreview();
    Utils.modal.hide('edit-question-modal');
    document.getElementById('edit-question-modal').remove();
    Utils.showToast('저장되었습니다.', 'success');
  },
  
  // 정답 설정
  setCorrectAnswer(questionIndex, choiceIndex) {
    this.generatedQuestions[questionIndex].correctAnswer = choiceIndex;
    this.renderQuestionsPreview();
    Utils.showToast('정답이 변경되었습니다.', 'success');
  },
  
  // 퀴즈 저장
  async saveQuiz() {
    const saveBtn = document.getElementById('save-quiz-btn');
    
    try {
      Utils.toggleLoading(saveBtn, true);
      
      const title = document.getElementById('quiz-title').value.trim();
      const prompt = document.getElementById('quiz-prompt').value.trim();
      const status = document.getElementById('quiz-status').value;
      const questionCount = this.generatedQuestions.length;
      const choiceCount = this.generatedQuestions[0].choices.length;
      
      const quizData = {
        teacher_id: this.teacherId,
        subject_id: this.subjectId,
        title,
        prompt,
        status,
        question_count: questionCount,
        choice_count: choiceCount,
        questions: this.generatedQuestions,
        has_file: this.uploadedFile !== null,
        file_name: this.uploadedFile?.name || null,
        file_type: this.uploadedFile?.type || null
      };
      
      // 파일이 있는 경우 Supabase Storage에 업로드
      if (this.uploadedFile && this.fileUploadComponent.getFiles().length > 0) {
        const rawFile = this.fileUploadComponent.getFiles()[0].raw;
        const uploadResult = await FileHandler.uploadToStorage(rawFile, 'quiz-files');
        quizData.file_url = uploadResult.url;
      }
      
      // 퀴즈 저장
      await DB.quizzes.create(quizData);
      
      Utils.showToast('퀴즈가 저장되었습니다!', 'success');
      
      // 퀴즈 목록으로 이동
      setTimeout(() => {
        window.location.href = `/teacher/quiz-list.html?subjectId=${this.subjectId}`;
      }, 1000);
      
    } catch (error) {
      console.error('Quiz save error:', error);
      Utils.handleError(error, '퀴즈 저장 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(saveBtn, false);
    }
  }
};

// 전역으로 export
window.QuizGenerator = QuizGenerator;
