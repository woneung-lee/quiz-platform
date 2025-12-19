// 퀴즈 결과 확인

const QuizResult = {
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
      this.renderResult();
    } catch (error) {
      console.error('Result initialization error:', error);
      Utils.handleError(error, '결과 로딩 중 오류가 발생했습니다.');
    }
  },
  
  // 퀴즈 정보 로드
  async loadQuiz() {
    try {
      this.quiz = await DB.quizzes.getById(this.quizId);
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
    
    document.getElementById('review-btn').addEventListener('click', () => {
      window.location.href = `/student/review.html?quizId=${this.quizId}`;
    });
  },
  
  // 결과 렌더링
  renderResult() {
    const percentage = Math.round((this.submission.score / this.submission.total_questions) * 100);
    
    // 결과 요약
    let icon, title, message;
    if (percentage >= 90) {
      icon = '🎉';
      title = '완벽합니다!';
      message = '정말 잘하셨어요!';
    } else if (percentage >= 70) {
      icon = '😊';
      title = '잘했어요!';
      message = '좋은 결과입니다!';
    } else if (percentage >= 40) {
      icon = '🙂';
      title = '괜찮아요!';
      message = '조금 더 노력해봐요!';
    } else {
      icon = '😢';
      title = '아쉬워요';
      message = '다시 복습해보세요!';
    }
    
    document.getElementById('result-icon').textContent = icon;
    document.getElementById('result-title').textContent = title;
    document.getElementById('result-score').textContent = 
      `${this.submission.score}/${this.submission.total_questions}`;
    document.getElementById('result-percentage').textContent = `${percentage}%`;
    document.getElementById('result-message').textContent = message;
    
    // 통계
    const wrong = this.submission.total_questions - this.submission.score;
    document.getElementById('stat-correct').textContent = this.submission.score;
    document.getElementById('stat-wrong').textContent = wrong;
    document.getElementById('stat-percentage').textContent = `${percentage}%`;
    
    // 문제별 결과
    this.renderQuestionResults();
  },
  
  // 문제별 결과 렌더링
  renderQuestionResults() {
    const container = document.getElementById('questions-result-container');
    
    let html = '';
    
    this.quiz.questions.forEach((question, index) => {
      const myAnswer = this.submission.answers[index];
      const isCorrect = myAnswer === question.correctAnswer;
      
      html += `
        <div class="question-result-item" style="margin-bottom: var(--spacing-lg); padding-bottom: var(--spacing-lg); border-bottom: 1px solid var(--border-color);">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: var(--spacing-md);">
            <span class="badge ${isCorrect ? 'badge-success' : 'badge-error'}">
              문제 ${index + 1}
            </span>
            ${isCorrect ? 
              '<span style="color: var(--success-color); font-weight: 600;">✓ 정답</span>' : 
              '<span style="color: var(--error-color); font-weight: 600;">✗ 오답</span>'
            }
          </div>
          
          <div style="font-weight: 600; margin-bottom: var(--spacing-sm);">
            ${Utils.escapeHtml(question.question)}
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${question.choices.map((choice, choiceIndex) => {
              let style = 'padding: 0.75rem; border-radius: var(--border-radius); ';
              let label = `④${choiceIndex + 1}`;
              
              if (choiceIndex === question.correctAnswer) {
                style += 'background-color: var(--success-light); border: 2px solid var(--success-color);';
                label += ' ✓ 정답';
              } else if (choiceIndex === myAnswer) {
                style += 'background-color: var(--error-light); border: 2px solid var(--error-color);';
                label += ' ← 내 답';
              } else {
                style += 'background-color: var(--gray-100); border: 2px solid transparent;';
              }
              
              return `
                <div style="${style}">
                  <strong>${label}:</strong> ${Utils.escapeHtml(choice)}
                </div>
              `;
            }).join('')}
          </div>
          
          ${question.explanation ? `
            <div style="margin-top: var(--spacing-md); padding: var(--spacing-md); background-color: var(--gray-50); border-radius: var(--border-radius);">
              <strong>해설:</strong> ${Utils.escapeHtml(question.explanation)}
            </div>
          ` : ''}
        </div>
      `;
    });
    
    container.innerHTML = html;
  }
};

// 전역으로 export
window.QuizResult = QuizResult;
