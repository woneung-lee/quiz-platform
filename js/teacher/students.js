// 학생 관리 기능

const StudentsManager = {
  teacherId: null,
  students: [],
  filteredStudents: [],
  
  // 초기화
  async init() {
    const user = Auth.getCurrentUser();
    if (!user || user.role !== 'teacher') {
      return;
    }
    
    this.teacherId = user.id;
    
    await this.loadStudents();
    this.setupEventListeners();
  },
  
  // 이벤트 리스너 설정
  setupEventListeners() {
    // 학생 추가 버튼
    document.getElementById('add-student-btn').addEventListener('click', () => {
      this.openStudentModal();
    });
    
    // 학생 폼 제출
    document.getElementById('student-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.addStudent();
    });
    
    // 검색
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      this.filterStudents(e.target.value);
    }, 300));
    
    // 학생 삭제 확인
    document.getElementById('confirm-delete-student-btn').addEventListener('click', async () => {
      await this.deleteStudent();
    });
  },
  
  // 학생 목록 로드
  async loadStudents() {
    const container = document.getElementById('students-table-container');
    
    try {
      this.students = await DB.users.getStudentsByTeacher(this.teacherId);
      this.filteredStudents = [...this.students];
      
      document.getElementById('student-count').textContent = this.students.length;
      
      if (this.students.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">👥</div>
            <p class="empty-state-title">아직 학생이 없습니다</p>
            <p class="empty-state-text">첫 번째 학생을 추가해보세요!</p>
            <button class="btn btn-primary" onclick="StudentsManager.openStudentModal()">
              ➕ 학생 추가하기
            </button>
          </div>
        `;
        return;
      }
      
      await this.renderStudentsTable();
      
    } catch (error) {
      console.error('Students loading error:', error);
      container.innerHTML = `
        <div class="alert alert-error">
          학생 목록을 불러오는 중 오류가 발생했습니다.
        </div>
      `;
    }
  },
  
  // 학생 테이블 렌더링
  async renderStudentsTable() {
    const container = document.getElementById('students-table-container');
    
    if (this.filteredStudents.length === 0) {
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
          검색 결과가 없습니다.
        </div>
      `;
      return;
    }
    
    let html = `
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>번호</th>
              <th>이름</th>
              <th>제출한 퀴즈</th>
              <th>평균 점수</th>
              <th>가입일</th>
              <th style="text-align: center;">작업</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    for (const student of this.filteredStudents) {
      // 제출 통계 가져오기
      const submissions = await DB.submissions.getByStudent(student.id);
      const submittedCount = submissions.filter(s => s.status === 'submitted').length;
      
      let avgScore = 0;
      if (submittedCount > 0) {
        const totalPercentage = submissions
          .filter(s => s.status === 'submitted')
          .reduce((sum, s) => sum + (s.score / s.total_questions * 100), 0);
        avgScore = Math.round(totalPercentage / submittedCount);
      }
      
      html += `
        <tr>
          <td>
            <strong>${student.student_number || '-'}</strong>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div class="avatar avatar-sm">${student.name.charAt(0)}</div>
              <strong>${Utils.escapeHtml(student.name)}</strong>
            </div>
          </td>
          <td>${submittedCount}개</td>
          <td>
            ${submittedCount > 0 ? `
              <span style="font-weight: 600; color: ${avgScore >= 70 ? 'var(--success-color)' : avgScore >= 40 ? 'var(--warning-color)' : 'var(--error-color)'};">
                ${avgScore}%
              </span>
            ` : '<span style="color: var(--text-secondary);">-</span>'}
          </td>
          <td>${Utils.formatDate(student.created_at, 'YYYY-MM-DD')}</td>
          <td>
            <div class="table-actions" style="justify-content: center;">
              <button class="btn btn-sm btn-outline" onclick="StudentsManager.viewStudentInfo('${student.id}')">
                상세보기
              </button>
              <button class="btn btn-sm btn-secondary" onclick="StudentsManager.confirmDeleteStudent('${student.id}', '${Utils.escapeHtml(student.name)}')">
                삭제
              </button>
            </div>
          </td>
        </tr>
      `;
    }
    
    html += `
          </tbody>
        </table>
      </div>
    `;
    
    container.innerHTML = html;
  },
  
  // 학생 필터링
  filterStudents(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      this.filteredStudents = [...this.students];
    } else {
      this.filteredStudents = this.students.filter(student => 
        student.name.toLowerCase().includes(term) ||
        (student.student_number && student.student_number.toString().includes(term))
      );
    }
    
    this.renderStudentsTable();
  },
  
  // 학생 추가 모달 열기
  openStudentModal() {
    document.getElementById('student-form').reset();
    Utils.modal.show('student-modal');
  },
  
  // 학생 추가
  async addStudent() {
    const submitBtn = document.getElementById('student-submit-btn');
    
    try {
      Utils.toggleLoading(submitBtn, true);
      
      const name = document.getElementById('student-name').value.trim();
      const studentNumber = parseInt(document.getElementById('student-number').value);
      const password = document.getElementById('student-password').value;
      const passwordConfirm = document.getElementById('student-password-confirm').value;
      
      // 유효성 검사
      if (!name || !studentNumber || !password) {
        Utils.showToast('모든 필드를 입력해주세요.', 'warning');
        return;
      }
      
      if (studentNumber < 1 || studentNumber > 999) {
        Utils.showToast('번호는 1-999 사이여야 합니다.', 'error');
        return;
      }
      
      if (password !== passwordConfirm) {
        Utils.showToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
      }
      
      if (password.length < 8) {
        Utils.showToast('비밀번호는 8자 이상이어야 합니다.', 'error');
        return;
      }
      
      // 학생 생성
      await Auth.createStudent(name, studentNumber, password, this.teacherId);
      
      Utils.modal.hide('student-modal');
      await this.loadStudents();
      
      // 생성된 계정 정보 표시
      Utils.showToast(`학생 계정이 생성되었습니다!\n이름: ${name} (번호 ${studentNumber})\n비밀번호: ${password}`, 'success');
      
    } catch (error) {
      console.error('Student creation error:', error);
      if (error.message.includes('이미 사용')) {
        Utils.showToast('이미 사용 중인 번호입니다.', 'error');
      } else {
        Utils.handleError(error, '학생 추가 중 오류가 발생했습니다.');
      }
    } finally {
      Utils.toggleLoading(submitBtn, false);
    }
  },
  
  // 학생 상세 정보 보기
  async viewStudentInfo(studentId) {
    try {
      const student = this.students.find(s => s.id === studentId);
      if (!student) return;
      
      // 제출 통계
      const submissions = await DB.submissions.getByStudent(studentId);
      const submittedCount = submissions.filter(s => s.status === 'submitted').length;
      
      document.getElementById('info-name').textContent = student.name;
      document.getElementById('info-username').textContent = student.username;
      document.getElementById('info-created').textContent = Utils.formatDate(student.created_at, 'YYYY-MM-DD HH:mm');
      document.getElementById('info-submissions').textContent = `${submittedCount}개`;
      
      Utils.modal.show('student-info-modal');
      
    } catch (error) {
      console.error('Student info error:', error);
      Utils.handleError(error, '학생 정보를 불러오는 중 오류가 발생했습니다.');
    }
  },
  
  // 삭제 확인 모달
  confirmDeleteStudent(studentId, studentName) {
    document.getElementById('delete-student-id').value = studentId;
    document.getElementById('delete-student-name').textContent = studentName;
    Utils.modal.show('delete-student-modal');
  },
  
  // 학생 삭제
  async deleteStudent() {
    const studentId = document.getElementById('delete-student-id').value;
    const confirmBtn = document.getElementById('confirm-delete-student-btn');
    
    try {
      Utils.toggleLoading(confirmBtn, true);
      
      await DB.users.delete(studentId);
      
      Utils.showToast('학생이 삭제되었습니다.', 'success');
      Utils.modal.hide('delete-student-modal');
      
      await this.loadStudents();
      
    } catch (error) {
      console.error('Student delete error:', error);
      Utils.handleError(error, '학생 삭제 중 오류가 발생했습니다.');
    } finally {
      Utils.toggleLoading(confirmBtn, false);
    }
  }
};

// 전역으로 export
window.StudentsManager = StudentsManager;
