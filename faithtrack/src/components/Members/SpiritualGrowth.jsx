import React, { useState } from 'react';
import './SpiritualGrowth.css';

const SpiritualGrowth = () => {
  const [showBibleModal, setShowBibleModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [currentReading, setCurrentReading] = useState(null);
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'history', 'upcoming', 'achievements'
  const [showStreakModal, setShowStreakModal] = useState(false);

  // Bible structure data
  const bibleBooks = [
    { id: 1, name: 'Genesis', chapters: 50, testament: 'Old Testament' },
    { id: 2, name: 'Exodus', chapters: 40, testament: 'Old Testament' },
    { id: 3, name: 'Leviticus', chapters: 27, testament: 'Old Testament' },
    { id: 4, name: 'Numbers', chapters: 36, testament: 'Old Testament' },
    { id: 5, name: 'Deuteronomy', chapters: 34, testament: 'Old Testament' },
    // More Old Testament books would be listed here
    { id: 40, name: 'Matthew', chapters: 28, testament: 'New Testament' },
    { id: 41, name: 'Mark', chapters: 16, testament: 'New Testament' },
    { id: 42, name: 'Luke', chapters: 24, testament: 'New Testament' },
    { id: 43, name: 'John', chapters: 21, testament: 'New Testament' },
    { id: 44, name: 'Acts', chapters: 28, testament: 'New Testament' },
    // More New Testament books would be listed here
  ];

  // Mock data for Bible reading plan
  const bibleReadingData = {
    currentPlan: 'Bible in a Year',
    progress: 35,
    currentBook: 'Exodus',
    currentChapter: 12,
    streak: 5,
    todaysReading: [
      { book: 'Exodus', chapters: '12-13', verificationQuestion: 'What was placed on the doorposts during Passover?', correctAnswer: 'blood' }
    ],
    recentActivity: [
      { date: '2025-05-01', book: 'Exodus', chapters: '10-11', completed: true },
      { date: '2025-04-30', book: 'Exodus', chapters: '8-9', completed: true },
      { date: '2025-04-29', book: 'Exodus', chapters: '6-7', completed: true },
      { date: '2025-04-28', book: 'Exodus', chapters: '4-5', completed: true },
      { date: '2025-04-27', book: 'Exodus', chapters: '1-3', completed: true },
    ],
    upcomingReadings: [
      { date: '2025-05-03', book: 'Exodus', chapters: '14-15' },
      { date: '2025-05-04', book: 'Exodus', chapters: '16-18' },
      { date: '2025-05-05', book: 'Exodus', chapters: '19-21' },
    ],
    achievements: [
      { id: 1, title: 'Genesis Complete', description: 'Read the entire book of Genesis', earned: true, date: '2025-04-25', icon: '📖' },
      { id: 2, title: 'First Week', description: 'Complete 7 consecutive days of reading', earned: true, date: '2025-04-22', icon: '🔥' },
      { id: 3, title: 'Early Riser', description: 'Complete a reading before 7 AM', earned: true, date: '2025-04-28', icon: '🌅' },
      { id: 4, title: 'Pentateuch Scholar', description: 'Complete the first five books of the Bible', earned: false, progress: 40, icon: '📚' },
      { id: 5, title: 'Wisdom Seeker', description: 'Read all Proverbs chapters', earned: false, progress: 0, icon: '🦉' },
      { id: 6, title: 'Gospel Truth', description: 'Complete all four Gospels', earned: false, progress: 0, icon: '✝️' },
    ]
  };

  const handleOpenBible = () => {
    setShowBibleModal(true);
  };

  const handleCloseBible = () => {
    setShowBibleModal(false);
    setSelectedBook(null);
  };

  const handleSelectBook = (book) => {
    setSelectedBook(book);
  };

  const handleMarkAsRead = (reading) => {
    setCurrentReading(reading);
    setShowVerificationModal(true);
  };

  const handleVerificationSubmit = () => {
    const reading = currentReading;
    if (verificationAnswer.toLowerCase() === reading.verificationQuestion.correctAnswer.toLowerCase()) {
      // In a real app, you would update the database here
      setShowVerificationModal(false);
      setVerificationAnswer('');
      setCurrentReading(null);
      
      // Show streak modal with animation
      setShowStreakModal(true);
      setTimeout(() => {
        setShowStreakModal(false);
      }, 3000);
    } else {
      alert('That answer is incorrect. Please try again.');
    }
  };

  const handleVerificationCancel = () => {
    setShowVerificationModal(false);
    setVerificationAnswer('');
    setCurrentReading(null);
  };

  return (
    <div className="spiritual-growth-container">
      <div className="spiritual-growth-box">
        <div className="spiritual-growth-header">
          <h1>Spiritual Growth</h1>
        </div>

        <div className="spiritual-growth-content">
          <div className="spiritual-growth-layout">
            {/* Left Column - Progress and Navigation */}
            <div className="spiritual-growth-sidebar">
              {/* Progress Card */}
              <div className="progress-card">
                <div className="progress-metrics">
                  <div 
                    className="progress-circle"
                    style={{ "--progress-value": bibleReadingData.progress }}
                  >
                    <div className="progress-circle-inner">
                      <div className="progress-percentage-large">{bibleReadingData.progress}%</div>
                      <div className="progress-label-small">Complete</div>
                    </div>
                  </div>
                  
                  <div className="progress-details">
                    <div className="progress-detail-item">
                      <div className="detail-label">Current Plan</div>
                      <div className="detail-value">{bibleReadingData.currentPlan}</div>
                    </div>
                    
                    <div className="progress-detail-item">
                      <div className="detail-label">Streak</div>
                      <div className="detail-value">
                        <span className="streak-flame">🔥</span> {bibleReadingData.streak} days
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Reading Info */}
              <div className="current-reading-info-card">
                <button className="view-bible-btn" onClick={handleOpenBible}>
                  View Full Bible
                </button>
              </div>

              {/* Reading Instructions */}
              <div className="reading-instructions">
                <h3>How to Complete Your Reading</h3>
                <ol>
                  <li>Read the assigned chapters in your Bible</li>
                  <li>Click "Mark as Read" when you've finished</li>
                  <li>Answer the verification question to confirm your reading</li>
                  <li>Maintain your reading streak!</li>
                </ol>
              </div>
            </div>

            {/* Right Column - Main Content */}
            <div className="spiritual-growth-main">
              {/* Navigation Tabs */}
              <div className="reading-tabs">
                <button 
                  className={`tab-btn ${activeTab === 'today' ? 'active' : ''}`}
                  onClick={() => setActiveTab('today')}
                >
                  Today's Reading
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                  onClick={() => setActiveTab('history')}
                >
                  Reading History
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
                  onClick={() => setActiveTab('upcoming')}
                >
                  Upcoming Readings
                </button>
                <button 
                  className={`tab-btn ${activeTab === 'achievements' ? 'active' : ''}`}
                  onClick={() => setActiveTab('achievements')}
                >
                  Achievements
                </button>
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {/* Today's Reading Tab */}
                {activeTab === 'today' && (
                  <div className="todays-reading-tab">
                    <div className="reading-cards">
                      {bibleReadingData.todaysReading.map((reading, index) => (
                        <div key={index} className="reading-card">
                          <div className="reading-card-header">
                            <h3>{reading.book} {reading.chapters}</h3>
                            <span className="reading-date">Today's Assignment</span>
                          </div>
                          <div className="reading-card-actions">
                            <button 
                              className="read-btn" 
                              onClick={() => handleMarkAsRead(reading)}
                            >
                              Mark as Read
                            </button>
                            <button 
                              className="view-chapter-btn" 
                              onClick={() => {
                                const book = bibleBooks.find(b => b.name === reading.book);
                                if (book) {
                                  handleSelectBook(book);
                                  setShowBibleModal(true);
                                }
                              }}
                            >
                              View Chapter
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reading History Tab */}
                {activeTab === 'history' && (
                  <div className="reading-history-tab">
                    <div className="history-header">
                      <h3>Your Recent Reading Activity</h3>
                    </div>
                    <div className="history-list">
                      {bibleReadingData.recentActivity.map((activity, index) => (
                        <div key={index} className="history-item">
                          <div className="history-date">
                            {new Date(activity.date).toLocaleDateString()}
                          </div>
                          <div className="history-details">
                            <span className="history-book">{activity.book}</span>
                            <span className="history-chapters">Chapters {activity.chapters}</span>
                          </div>
                          <div className={`history-status ${activity.completed ? 'completed' : 'missed'}`}>
                            {activity.completed ? 'Completed' : 'Missed'}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="history-summary">
                      <div className="summary-stat">
                        <span className="stat-value">5</span>
                        <span className="stat-label">Days Streak</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-value">28</span>
                        <span className="stat-label">Chapters Read</span>
                      </div>
                      <div className="summary-stat">
                        <span className="stat-value">100%</span>
                        <span className="stat-label">Completion Rate</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upcoming Readings Tab */}
                {activeTab === 'upcoming' && (
                  <div className="upcoming-readings-tab">
                    <div className="upcoming-header">
                      <h3>Your Reading Plan for the Next Days</h3>
                    </div>
                    <div className="upcoming-list">
                      {bibleReadingData.upcomingReadings.map((reading, index) => (
                        <div key={index} className="upcoming-item">
                          <div className="upcoming-date">
                            {new Date(reading.date).toLocaleDateString()}
                          </div>
                          <div className="upcoming-details">
                            <span className="upcoming-book">{reading.book}</span>
                            <span className="upcoming-chapters">Chapters {reading.chapters}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="plan-info">
                      <h4>About Your Reading Plan</h4>
                      <p>
                        You're following the "Bible in a Year" plan, which guides you through the entire Bible in 365 days.
                        The readings are arranged to give you portions from different sections of the Bible each day.
                      </p>
                      <p>
                        Your current pace: <strong>On Schedule</strong>
                      </p>
                    </div>
                  </div>
                )}

                {/* Achievements Tab */}
                {activeTab === 'achievements' && (
                  <div className="achievements-tab">
                    <div className="achievements-header">
                      <h3>Your Bible Reading Achievements</h3>
                    </div>
                    <div className="achievements-grid">
                      {bibleReadingData.achievements.map((achievement) => (
                        <div 
                          key={achievement.id} 
                          className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}
                        >
                          <div className="achievement-icon">{achievement.icon}</div>
                          <div className="achievement-content">
                            <h4 className="achievement-title">{achievement.title}</h4>
                            <p className="achievement-description">{achievement.description}</p>
                            {achievement.earned ? (
                              <div className="achievement-earned">
                                Earned on {new Date(achievement.date).toLocaleDateString()}
                              </div>
                            ) : (
                              <div className="achievement-progress">
                                <div className="progress-bar">
                                  <div 
                                    className="progress-fill" 
                                    style={{ width: `${achievement.progress}%` }}
                                  ></div>
                                </div>
                                <span className="progress-text">{achievement.progress}% Complete</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bible Viewer Modal */}
      {showBibleModal && (
        <div className="modal-overlay">
          <div className="bible-modal">
            <div className="bible-modal-header">
              <h2>Bible Viewer</h2>
              <button className="close-modal-btn" onClick={handleCloseBible}>×</button>
            </div>
            <div className="bible-modal-content">
              {!selectedBook ? (
                <div className="bible-books-list">
                  <div className="testament-section">
                    <h3>Old Testament</h3>
                    <div className="books-grid">
                      {bibleBooks
                        .filter(book => book.testament === 'Old Testament')
                        .map(book => (
                          <button 
                            key={book.id} 
                            className="book-btn"
                            onClick={() => handleSelectBook(book)}
                          >
                            {book.name}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                  <div className="testament-section">
                    <h3>New Testament</h3>
                    <div className="books-grid">
                      {bibleBooks
                        .filter(book => book.testament === 'New Testament')
                        .map(book => (
                          <button 
                            key={book.id} 
                            className="book-btn"
                            onClick={() => handleSelectBook(book)}
                          >
                            {book.name}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                </div>
              ) : (
                <div className="book-viewer">
                  <div className="book-header">
                    <h3>{selectedBook.name}</h3>
                    <button className="back-btn" onClick={() => setSelectedBook(null)}>
                      Back to Books
                    </button>
                  </div>
                  <div className="chapters-grid">
                    {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chapter => (
                      <button key={chapter} className="chapter-btn">
                        {chapter}
                      </button>
                    ))}
                  </div>
                  <div className="chapter-content">
                    <p className="placeholder-text">
                      Select a chapter to view its content. In a real application, this would display the actual Bible text.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && currentReading && (
        <div className="modal-overlay">
          <div className="verification-modal">
            <div className="verification-modal-header">
              <h2>Verify Your Reading</h2>
              <button className="close-modal-btn" onClick={handleVerificationCancel}>×</button>
            </div>
            <div className="verification-modal-content">
              <p>To mark {currentReading.book} {currentReading.chapters} as read, please answer the following question:</p>
              <div className="verification-question">
                <p>{currentReading.verificationQuestion}</p>
                <input
                  type="text"
                  value={verificationAnswer}
                  onChange={(e) => setVerificationAnswer(e.target.value)}
                  placeholder="Your answer"
                  className="verification-input"
                />
              </div>
              <div className="verification-actions">
                <button className="cancel-btn" onClick={handleVerificationCancel}>Cancel</button>
                <button className="submit-btn" onClick={handleVerificationSubmit}>Submit</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Streak Modal */}
      {showStreakModal && (
        <div className="streak-modal-overlay">
          <div className="streak-modal">
            <div className="streak-content">
              <div className="streak-icon">🔥</div>
              <h2 className="streak-title">Day Streak: {bibleReadingData.streak}</h2>
              <p className="streak-message">Keep it up! You're building a great habit.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpiritualGrowth;
