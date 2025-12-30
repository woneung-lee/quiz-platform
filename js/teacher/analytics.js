// 결과 분석

const QuizAnalytics = {
  teacherId: null,
  quizId: null,
  quiz: null,
  students: [],
  submissions: [],
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
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
      await this.loadStudents();
      await this.loadSubmissions();
      this.setupEventListeners();
    } catch (error) {
      console.error('Analytics initialization error:', error);
      Utils.handleError(error, '분석 초기화 중 오류가 발생했습니다.');
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
  
  // 학생 목록 로드
  async loadStudents() {
    try {
      this.students = await DB.users.getStudentsByTeacher(this.teacherId);
    } catch (error) {
      console.error('Students loading error:', error);
      throw error;
    }
  },
  
  // 제출 현황 로드
  async loadSubmissions() {
    try {
      this.submissions = await DB.submissions.getByQuiz(this.quizId);
      this.submissions = this.submissions.filter(s => s.status === 'submitted');
      this.updateUI();
    } catch (error) {
      console.error('Submissions loading error:', error);
      throw error;
    }
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    document.getElementById('export-excel-btn').addEventListener('click', () => {
      this.exportToExcel();
    });
  },
  
  // UI 업데이트
  updateUI() {
    this.updateStats();
    this.renderStudentsTable();
    this.renderQuestionsTable();
  },
  
  // 통계 업데이트
  updateStats() {
    if (this.submissions.length === 0) {
      document.getElementById('stat-avg-score').textContent = '0%';
      document.getElementById('stat-pass-rate').textContent = '0%';
      document.getElementById('stat-highest').textContent = '0점';
      document.getElementById('stat-lowest').textContent = '0점';
      return;
    }
    
    // 평균 점수
    const totalPercentage = this.submissions.reduce((sum, s) => 
      sum + (s.score / s.total_questions * 100), 0
    );
    const avgScore = Math.round(totalPercentage / this.submissions.length);
    
    // 합격률 (70% 이상)
    const passCount = this.submissions.filter(s => 
      (s.score / s.total_questions * 100) >= 70
    ).length;
    const passRate = Math.round((passCount / this.submissions.length) * 100);
    
    // 최고/최저 점수
    const scores = this.submissions.map(s => s.score);
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    
    document.getElementById('stat-avg-score').textContent = `${avgScore}%`;
    document.getElementById('stat-pass-rate').textContent = `${passRate}%`;
    document.getElementById('stat-highest').textContent = `${highest}/${this.quiz.question_count}점`;
    document.getElementById('stat-lowest').textContent = `${lowest}/${this.quiz.question_count}점`;
  },
  
  // 학생별 성적 테이블 렌더링
  renderStudentsTable() {
    const container = document.getElementById('students-table-container');
    
    if (this.submissions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <p class="empty-state-title">아직 제출된 답안이 없습니다</p>
        </div>
      `;
      return;
    }
    
    // 점수순 정렬
    const sortedSubmissions = [...this.submissions].sort((a, b) => b.score - a.score);
    
    let html = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>순위</th>
              <th>학생</th>
              <th style="text-align: center;">점수</th>
              <th style="text-align: center;">정답률</th>
              <th style="text-align: center;">정답 / 오답</th>
              <th style="text-align: center;">제출 시간</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    sortedSubmissions.forEach((submission, index) => {
      const percentage = Math.round((submission.score / submission.total_questions) * 100);
      const wrong = submission.total_questions - submission.score;
      
      html += `
        <tr>
          <td style="font-weight: 600;">
            ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="avatar avatar-sm">${submission.users.name.charAt(0)}</div>
              <strong>${Utils.escapeHtml(submission.users.name)}</strong>
            </div>
          </td>
          <td style="text-align: center; font-weight: 600;">
            ${submission.score}/${submission.total_questions}
          </td>
          <td style="text-align: center;">
            <span style="font-weight: 600; color: ${percentage >= 70 ? 'var(--success-color)' : percentage >= 40 ? 'var(--warning-color)' : 'var(--error-color)'};">
              ${percentage}%
            </span>
          </td>
          <td style="text-align: center;">
            <span style="color: var(--success-color);">✓ ${submission.score}</span> /
            <span style="color: var(--error-color);">✗ ${wrong}</span>
          </td>
          <td style="text-align: center; font-size: 0.875rem; color: var(--text-secondary);">
            ${Utils.formatDate(submission.submitted_at, 'YYYY-MM-DD HH:mm')}
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  // 문제별 정답률 테이블 렌더링
  renderQuestionsTable() {
    const container = document.getElementById('questions-table-container');
    
    if (this.submissions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <p class="empty-state-title">아직 제출된 답안이 없습니다</p>
        </div>
      `;
      return;
    }
    
    const questionStats = [];
    
    // 각 문제별 통계 계산
    for (let i = 0; i < this.quiz.question_count; i++) {
      let correctCount = 0;
      
      this.submissions.forEach(submission => {
        if (submission.answers[i] === this.quiz.questions[i].correctAnswer) {
          correctCount++;
        }
      });
      
      const correctRate = Math.round((correctCount / this.submissions.length) * 100);
      
      questionStats.push({
        questionNumber: i + 1,
        question: this.quiz.questions[i].question,
        correctCount,
        wrongCount: this.submissions.length - correctCount,
        correctRate
      });
    }
    
    // 정답률 낮은 순으로 정렬 (어려운 문제 먼저)
    questionStats.sort((a, b) => a.correctRate - b.correctRate);
    
    let html = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>문제</th>
              <th>문제 내용</th>
              <th style="text-align: center;">정답자</th>
              <th style="text-align: center;">오답자</th>
              <th style="text-align: center;">정답률</th>
              <th style="text-align: center;">난이도</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    questionStats.forEach(stat => {
      let difficulty, difficultyColor;
      if (stat.correctRate >= 80) {
        difficulty = '쉬움';
        difficultyColor = 'var(--success-color)';
      } else if (stat.correctRate >= 50) {
        difficulty = '보통';
        difficultyColor = 'var(--warning-color)';
      } else {
        difficulty = '어려움';
        difficultyColor = 'var(--error-color)';
      }
      
      html += `
        <tr>
          <td style="font-weight: 600;">문제 ${stat.questionNumber}</td>
          <td>${Utils.truncate(Utils.escapeHtml(stat.question), 60)}</td>
          <td style="text-align: center; color: var(--success-color); font-weight: 600;">
            ${stat.correctCount}명
          </td>
          <td style="text-align: center; color: var(--error-color); font-weight: 600;">
            ${stat.wrongCount}명
          </td>
          <td style="text-align: center;">
            <div style="display: inline-block; width: 100px;">
              <div class="progress" style="height: 6px;">
                <div class="progress-bar" style="width: ${stat.correctRate}%; background-color: ${difficultyColor};"></div>
              </div>
              <div style="font-size: 0.875rem; margin-top: 0.25rem; font-weight: 600;">
                ${stat.correctRate}%
              </div>
            </div>
          </td>
          <td style="text-align: center;">
            <span class="badge" style="background-color: ${difficultyColor}; color: white;">
              ${difficulty}
            </span>
          </td>
        </tr>
      `;
    });
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
// 엑셀 내보내기 (보완 버전)
  exportToExcel() {
    try {
      const wb = XLSX.utils.book_new();
      
      // --- 시트 1: 퀴즈 요약 정보 ---
      const quizInfo = [
        ['퀴즈 분석 리포트'],
        [''],
        ['퀴즈 제목', this.quiz.title],
        ['문제 수', this.quiz.question_count],
        ['제출자 수', this.submissions.length],
        ['평균 점수', document.getElementById('stat-avg-score').textContent],
        ['분석 일시', Utils.formatDate(new Date(), 'YYYY-MM-DD HH:mm')]
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(quizInfo);
      XLSX.utils.book_append_sheet(wb, ws1, '요약');

      // --- 시트 2: 학생별 성적 리스트 ---
      const studentData = [['순위', '학생 이름', '점수', '정답률', '정답 수', '오답 수', '제출 시간']];
      const sortedSubmissions = [...this.submissions].sort((a, b) => b.score - a.score);
      sortedSubmissions.forEach((submission, index) => {
        const percentage = Math.round((submission.score / submission.total_questions) * 100);
        studentData.push([
          index + 1,
          submission.users.name,
          `${submission.score}/${submission.total_questions}`,
          `${percentage}%`,
          submission.score,
          submission.total_questions - submission.score,
          Utils.formatDate(submission.submitted_at, 'YYYY-MM-DD HH:mm')
        ]);
      });
      const ws2 = XLSX.utils.aoa_to_sheet(studentData);
      XLSX.utils.book_append_sheet(wb, ws2, '학생별 결과');

      // --- 시트 3: ★ 문항별 상세 정오표 (핵심 추가) ★ ---
      // 가로축에 학생 이름, 세로축에 문제 번호가 나열되는 표입니다.
      const detailHeaders = ['번호', '문제 내용', '정답률'];
      const studentNames = sortedSubmissions.map(s => s.users.name);
      const combinedHeaders = [...detailHeaders, ...studentNames];

      const detailRows = [combinedHeaders];

      for (let i = 0; i < this.quiz.question_count; i++) {
        let correctCount = 0;
        const row = [
          i + 1,
          this.quiz.questions[i].question,
          '' // 정답률 자리는 계산 후 삽입
        ];

        // 각 학생의 해당 문제 정답 여부 체크
        sortedSubmissions.forEach(submission => {
          const isCorrect = submission.answers[i] === this.quiz.questions[i].correctAnswer;
          row.push(isCorrect ? 'O' : 'X');
          if (isCorrect) correctCount++;
        });

        // 정답률 계산
        row[2] = `${Math.round((correctCount / this.submissions.length) * 100)}%`;
        detailRows.push(row);
      }
      const ws3 = XLSX.utils.aoa_to_sheet(detailRows);
      XLSX.utils.book_append_sheet(wb, ws3, '문항별 정오표');

      // 파일 다운로드
      const fileName = `${this.quiz.title}_상세분석_${Utils.formatDate(new Date(), 'YYYYMMDD')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      Utils.showToast('상세 분석 엑셀이 다운로드되었습니다.', 'success');
      
    } catch (error) {
      console.error('Excel export error:', error);
      Utils.handleError(error, '엑셀 생성 중 오류가 발생했습니다.');
    }
  }
};

// 전역으로 export
window.QuizAnalytics = QuizAnalytics;
