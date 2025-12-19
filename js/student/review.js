// 복습 모드

const QuizReview = {
  studentId: null,
  quizId: null,
  quiz: null,
  submission: null,
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'student') {
      return;
    }
    
    this.studentId = user.id;
    
    // URL에서 quizId 가져오기
    const params = Utils.getQueryParams();
    this.quizId = params.quizId;
    
    if (!this.quizId) {
      Utils.showToast('퀴즈를 선택해주세요.', 'warning');
      window.history.back();
      return;
    }
    
    try {
      await this.loadQuiz();
      await this.loadSubmission();
      this.setupEventListeners();
      this.renderReview();
    } catch (error) {
      console.error('Review initialization error:', error);
      Utils.handleError(error, '복습 모드 로딩 중 오류가 발생했습니다.');
    }
  },
  
  // 퀴즈 정보 로드
  async loadQuiz() {
    try {
      this.quiz = await DB.quizzes.getById(this.quizId);
      
      document.getElementById('quiz-title-display').textContent = this.quiz.title;
    } catch (error) {
      console.error('Quiz loading error:', error);
      throw error;
    }
  },
  
  // 제출 정보 로드
  async loadSubmission() {
    try {
      const submissions = await DB.submissions.getByStudent(this.studentId);
      this.submission = submissions.find(s => 
        s.quiz_id === this.quizId && s.status === 'submitted'
      );
      
      if (!this.submission) {
        Utils.showToast('제출 기록을 찾을 수 없습니다.', 'error');
        window.history.back();
        return;
      }
      
      const percentage = Math.round((this.submission.score / this.submission.total_questions) * 100);
      document.getElementById('my-score').textContent = 
        `${this.submission.score}/${this.submission.total_questions}`;
      document.getElementById('my-percentage').textContent = `${percentage}%`;
      
    } catch (error) {
      console.error('Submission loading error:', error);
      throw error;
    }
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    document.getElementById('back-btn').addEventListener('click', () => {
      window.location.href = '/student/dashboard.html';
    });
  },
  
  // 복습 모드 렌더링
  renderReview() {
    const allQuestions = [];
    const correctQuestions = [];
    const wrongQuestions = [];
    
    this.quiz.questions.forEach((question, index) => {
      const myAnswer = this.submission.answers[index];
      const isCorrect = myAnswer === question.correctAnswer;
      
      const questionData = { question, index, myAnswer, isCorrect };
      
      allQuestions.push(questionData);
      if (isCorrect) {
        correctQuestions.push(questionData);
      } else {
        wrongQuestions.push(questionData);
      }
    });
    
    // 각 탭 렌더링
    this.renderQuestions('all-questions-container', allQuestions);
    this.renderQuestions('correct-questions-container', correctQuestions);
    this.renderQuestions('wrong-questions-container', wrongQuestions);
  },
  
  // 문제 목록 렌더링
  renderQuestions(containerId, questions) {
    const container = document.getElementById(containerId);
    
    if (questions.length === 0) {
      const emptyMessages = {
        'all-questions-container': '문제가 없습니다.',
        'correct-questions-container': '맞은 문제가 없습니다.',
        'wrong-questions-container': '틀린 문제가 없습니다. 완벽합니다!'
      };
      
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${containerId.includes('wrong') ? '🎉' : '📝'}</div>
          <p class="empty-state-title">${emptyMessages[containerId]}</p>
        </div>
      `;
      return;
    }
    
    let html = '';
    
    questions.forEach(({ question, index, myAnswer, isCorrect }) => {
      html += `
        <div class="review-question-card">
          <div class="question-preview-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="question-number">문제 ${index + 1}</span>
              ${isCorrect ? 
                '<span class="badge badge-success">✓ 정답</span>' : 
                '<span class="badge badge-error">✗ 오답</span>'
              }
            </div>
          </div>
          
          <div class="question-text">${Utils.escapeHtml(question.question)}</div>
          
          <div class="choices-list">
            ${question.choices.map((choice, choiceIndex) => {
              let className = 'choice-item disabled';
              let marker = '';
              
              if (choiceIndex === question.correctAnswer) {
                className += ' correct';
                marker = '<span class="choice-check">✓ 정답</span>';
              } else if (choiceIndex === myAnswer) {
                className += ' wrong';
                marker = '<span class="choice-check">✗ 내 답</span>';
              }
              
              return `
                <div class="${className}">
                  <span class="choice-label">④${choiceIndex + 1}</span>
                  <span class="choice-text">${Utils.escapeHtml(choice)}</span>
                  ${marker}
                </div>
              `;
            }).join('')}
          </div>
          
          ${question.explanation ? `
            <div class="explanation-section">
              <div class="explanation-label">해설</div>
              <div class="explanation-text">${Utils.escapeHtml(question.explanation)}</div>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
};

// 전역으로 export
window.QuizReview = QuizReview;
