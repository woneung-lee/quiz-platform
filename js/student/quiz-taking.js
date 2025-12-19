// 퀴즈 풀이

const QuizTaking = {
  studentId: null,
  quizId: null,
  quiz: null,
  submission: null,
  answers: [],
  currentQuestionIndex: 0,
  
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
      await this.checkExistingSubmission();
      this.setupEventListeners();
      this.renderCurrentQuestion();
    } catch (error) {
      console.error('Quiz taking initialization error:', error);
      Utils.handleError(error, '퀴즈 로딩 중 오류가 발생했습니다.');
    }
  },
  
  // 퀴즈 정보 로드
  async loadQuiz() {
    try {
      this.quiz = await DB.quizzes.getById(this.quizId);
      
      // 퀴즈 정보 표시
      document.getElementById('quiz-title-display').textContent = this.quiz.title;
      document.getElementById('quiz-meta').textContent = 
        `${this.quiz.question_count}개 문제 · ${this.quiz.choice_count}지선다`;
      document.getElementById('total-questions').textContent = this.quiz.question_count;
      
      // 답안 배열 초기화 (모두 -1로)
      this.answers = new Array(this.quiz.question_count).fill(-1);
      
    } catch (error) {
      console.error('Quiz loading error:', error);
      throw error;
    }
  },
  
  // 기존 제출 확인
  async checkExistingSubmission() {
    try {
      const submissions = await DB.submissions.getByStudent(this.studentId);
      const existingSubmission = submissions.find(s => 
        s.quiz_id === this.quizId && s.status === 'submitted'
      );
      
      if (existingSubmission) {
        // 이미 제출한 경우
        Utils.showToast('이미 제출한 퀴즈입니다. 결과 페이지로 이동합니다.', 'info');
        setTimeout(() => {
          window.location.href = `/student/result.html?quizId=${this.quizId}`;
        }, 1500);
        return;
      }
      
      // 진행 중인 제출 찾기
      const inProgressSubmission = submissions.find(s => 
        s.quiz_id === this.quizId && s.status === 'in-progress'
      );
      
      if (inProgressSubmission) {
        // 진행 중인 답안 복원
        this.submission = inProgressSubmission;
        this.answers = inProgressSubmission.answers || this.answers;
      }
      
    } catch (error) {
      console.error('Submission check error:', error);
      throw error;
    }
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    document.getElementById('prev-btn').addEventListener('click', () => {
      this.goToPrevQuestion();
    });
    
    document.getElementById('next-btn').addEventListener('click', () => {
      this.goToNextQuestion();
    });
    
    document.getElementById('review-answers-btn').addEventListener('click', () => {
      this.currentQuestionIndex = 0;
      this.renderCurrentQuestion();
      document.getElementById('submit-card').style.display = 'none';
    });
    
    document.getElementById('submit-btn').addEventListener('click', async () => {
      await this.submitQuiz();
    });
  },
  
  // 현재 문제 렌더링
  renderCurrentQuestion() {
    const container = document.getElementById('quiz-container');
    const question = this.quiz.questions[this.currentQuestionIndex];
    
    let html = `
      <div class="question-card">
        <div class="question-header">
          <span class="question-number">문제 ${this.currentQuestionIndex + 1}</span>
        </div>
        
        <div class="question-text">${Utils.escapeHtml(question.question)}</div>
        
        <div class="choices-list">
    `;
    
    question.choices.forEach((choice, index) => {
      const isSelected = this.answers[this.currentQuestionIndex] === index;
      
      html += `
        <div class="choice-item ${isSelected ? 'selected' : ''}" 
             onclick="QuizTaking.selectAnswer(${index})">
          <span class="choice-label">④${index + 1}</span>
          <span class="choice-text">${Utils.escapeHtml(choice)}</span>
          ${isSelected ? '<span class="choice-check">✓</span>' : ''}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    
    // 네비게이션 버튼 상태 업데이트
    this.updateNavigation();
    
    // 진행률 업데이트
    this.updateProgress();
  },
  
  // 답안 선택
  selectAnswer(choiceIndex) {
    this.answers[this.currentQuestionIndex] = choiceIndex;
    this.renderCurrentQuestion();
    
    // 진행 중 상태 자동 저장
    this.autoSave();
  },
  
  // 이전 문제
  goToPrevQuestion() {
    if (this.currentQuestionIndex > 0) {
      this.currentQuestionIndex--;
      this.renderCurrentQuestion();
    }
  },
  
  // 다음 문제
  goToNextQuestion() {
    if (this.currentQuestionIndex < this.quiz.question_count - 1) {
      this.currentQuestionIndex++;
      this.renderCurrentQuestion();
    } else {
      // 마지막 문제에서 다음 버튼 누르면 제출 카드 표시
      document.getElementById('submit-card').style.display = 'block';
      document.getElementById('submit-card').scrollIntoView({ behavior: 'smooth' });
    }
  },
  
  // 네비게이션 버튼 상태 업데이트
  updateNavigation() {
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    
    prevBtn.disabled = this.currentQuestionIndex === 0;
    
    if (this.currentQuestionIndex === this.quiz.question_count - 1) {
      nextBtn.textContent = '제출 확인 →';
    } else {
      nextBtn.textContent = '다음 문제 →';
    }
    
    document.getElementById('current-question').textContent = this.currentQuestionIndex + 1;
  },
  
  // 진행률 업데이트
  updateProgress() {
    const answeredCount = this.answers.filter(a => a !== -1).length;
    const percentage = Math.round((answeredCount / this.quiz.question_count) * 100);
    
    // 원형 프로그레스 바
    const circle = document.getElementById('progress-circle');
    const circumference = 220; // 2 * Math.PI * 35
    const offset = circumference - (percentage / 100) * circumference;
    circle.style.strokeDashoffset = offset;
    
    document.getElementById('progress-text').textContent = `${percentage}%`;
  },
  
  // 자동 저장
  autoSave: Utils.debounce(async function() {
    try {
      if (!this.submission) {
        // 새로 생성
        const submissionData = {
          quiz_id: this.quizId,
          student_id: this.studentId,
          subject_id: this.quiz.subject_id,
          answers: this.answers,
          score: 0,
          total_questions: this.quiz.question_count,
          status: 'in-progress'
        };
        
        this.submission = await DB.submissions.create(submissionData);
      } else {
        // 업데이트
        await DB.submissions.update(this.submission.id, {
          answers: this.answers
        });
      }
    } catch (error) {
      console.error('Auto save error:', error);
    }
  }, 2000),
  
  // 퀴즈 제출
  async submitQuiz() {
    const submitBtn = document.getElementById('submit-btn');
    
    // 미답변 문제 확인
    const unansweredCount = this.answers.filter(a => a === -1).length;
    if (unansweredCount > 0) {
      const confirmed = confirm(`${unansweredCount}개 문제에 답하지 않았습니다. 그래도 제출하시겠습니까?`);
      if (!confirmed) return;
    }
    
    try {
      Utils.toggleLoading(submitBtn, true);
      
      // 점수 계산
      let score = 0;
      this.quiz.questions.forEach((question, index) => {
        if (this.answers[index] === question.correctAnswer) {
          score++;
        }
      });
      
      // 제출
      if (!this.submission) {
        // 새로 생성
        await DB.submissions.create({
          quiz_id: this.quizId,
          student_id: this.studentId,
          subject_id: this.quiz.subject_id,
          answers: this.answers,
          score,
          total_questions: this.quiz.question_count,
          status: 'submitted'
        });
      } else {
        // 업데이트
        await DB.submissions.update(this.submission.id, {
          answers: this.answers,
          score,
          status: 'submitted'
        });
      }
      
      Utils.showToast('제출되었습니다!', 'success');
      
      // 결과 페이지로 이동
      setTimeout(() => {
        window.location.href = `/student/result.html?quizId=${this.quizId}`;
      }, 1000);
      
    } catch (error) {
      console.error('Submit error:', error);
      Utils.handleError(error, '제출 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(submitBtn, false);
    }
  }
};

// 전역으로 export
window.QuizTaking = QuizTaking;
