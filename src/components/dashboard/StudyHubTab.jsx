import { useEffect, useMemo, useState } from 'react'

const tracks = [
  {
    id: 'dsa',
    title: 'Data Structures & Algorithms',
    category: 'Programming Track',
    topics: 'Arrays, Linked Lists, Stacks, Queues, Trees, Graphs, Dynamic Programming',
    status: 'Learning Content',
    icon: '💻',
    description:
      'Build problem-solving skills by understanding data structures, algorithms, complexity analysis and common coding patterns.',
    level: 'Beginner to Advanced',
    duration: '8–10 Weeks',
    topicList: [
      { title: 'Arrays', description: 'Indexing, traversal, insertion, deletion, searching and sorting.' },
      { title: 'Linked Lists', description: 'Singly, doubly and circular linked lists, operations and reversal.' },
      { title: 'Stacks', description: 'LIFO principle, stack operations and common applications.' },
      { title: 'Queues', description: 'FIFO principle, circular queues, dequeues and priority queues.' },
      { title: 'Trees', description: 'Binary trees, BST, traversals, height and balanced trees.' },
      { title: 'Graphs', description: 'Graph representation, BFS, DFS and shortest-path fundamentals.' },
      { title: 'Dynamic Programming', description: 'Overlapping subproblems, memoization and tabulation.' },
    ],
  },
  {
    id: 'dbms',
    title: 'DBMS & SQL Mastery',
    category: 'Core CS Track',
    topics: 'Database basics, Relational Model, SQL, Normalization, Indexing, Transactions',
    status: 'Learning Roadmap',
    icon: '🗄️',
    description: 'Understand database concepts, relational models, SQL and reliable data management.',
    level: 'Beginner to Intermediate',
    duration: '5–6 Weeks',
    topicList: [
      { title: 'Introduction to DBMS', description: 'Database concepts, DBMS advantages, architecture and data independence.' },
      { title: 'Relational Model', description: 'Relations, tuples, attributes, domains, keys and constraints.' },
      { title: 'SQL Fundamentals', description: 'DDL, DML, DQL, filtering, sorting, joins and aggregate functions.' },
      { title: 'Normalization', description: 'Functional dependencies and 1NF, 2NF, 3NF and BCNF.' },
      { title: 'Indexing', description: 'Index structures, primary and secondary indexes and query performance.' },
      { title: 'Transactions & ACID', description: 'Atomicity, consistency, isolation, durability and concurrency control.' },
    ],
  },
  {
    id: 'os',
    title: 'Operating Systems & Concurrency',
    category: 'Core CS Track',
    topics: 'Processes, Threads, CPU Scheduling, Synchronization, Deadlocks, Memory Management',
    status: 'Learning Roadmap',
    icon: '⚙️',
    description: 'Explore how operating systems manage processes, memory, files and system resources.',
    level: 'Intermediate',
    duration: '5–6 Weeks',
    topicList: [
      { title: 'Introduction to OS', description: 'Operating system roles, services, types and architecture.' },
      { title: 'Process Management', description: 'Processes, process states, PCB, context switching and threads.' },
      { title: 'CPU Scheduling', description: 'FCFS, SJF, Priority and Round Robin scheduling algorithms.' },
      { title: 'Synchronization', description: 'Critical sections, race conditions, mutexes and semaphores.' },
      { title: 'Deadlocks', description: 'Necessary conditions, prevention, avoidance and detection.' },
      { title: 'Memory Management', description: 'Paging, segmentation, virtual memory and page replacement.' },
    ],
  },
  {
    id: 'college',
    title: 'College Semester Syllabus Notes',
    category: 'University Curriculum',
    topics: 'Semester subjects, unit-wise notes, important questions and revision',
    status: 'Roadmap Preview',
    icon: '📖',
    description: 'Organize university preparation through semester-wise subjects, units and revision resources.',
    level: 'University Level',
    duration: 'Semester Based',
    topicList: [
      { title: 'Semester Subjects', description: 'Explore subjects according to your branch and semester.' },
      { title: 'Unit-wise Notes', description: 'Study each subject through structured unit-wise material.' },
      { title: 'Important Questions', description: 'Practice important questions for university examinations.' },
      { title: 'Previous Year Questions', description: 'Use previous examination questions for revision and practice.' },
      { title: 'Revision Resources', description: 'Prepare using concise revision sheets and topic summaries.' },
    ],
  },
]

const categories = [
  'All',
  'Programming Track',
  'Core CS Track',
  'University Curriculum',
]

const dsaLessons = {
  Arrays: {
    introduction: 'An array is a linear data structure that stores elements of the same data type in contiguous memory locations. Each element is accessed using an index.',
    notes: [
      'C++ arrays use zero-based indexing: the first element is at index 0.',
      'Accessing an element by index takes O(1) time.',
      'Traversing n elements takes O(n) time.',
      'Insertion or deletion in the middle may require shifting elements and can take O(n) time.',
      'A basic fixed-size C++ array has a size decided at declaration.',
    ],
    example: 'A student marks list can be stored in one array instead of creating a separate variable for every student.',
    code: `#include <iostream>
using namespace std;

int main() {
    int marks[5] = {80, 75, 90, 85, 95};

    for (int i = 0; i < 5; i++) {
        cout << marks[i] << endl;
    }
    return 0;
}`,
    question: 'What is the index of the first element in a C++ array?',
    options: ['1', '0', '-1', 'Depends on array size'],
    answer: 1,
    explanation: 'C++ arrays use zero-based indexing, so the first element is at index 0.',
  },
  'Linked Lists': {
    introduction: 'A linked list is a linear data structure made of nodes. Each node stores data and a link to the next node. Unlike arrays, nodes do not need to occupy contiguous memory locations.',
    notes: [
      'A node commonly contains data and a pointer to the next node.',
      'The head pointer refers to the first node.',
      'Insertion and deletion at a known position can be efficient because elements need not be shifted.',
      'Accessing the kth element requires traversal and takes O(n) time.',
      'A singly linked list points forward; a doubly linked list has next and previous links.',
      'A circular linked list connects its last node back to the first node.',
    ],
    example: 'A music playlist can be represented as linked nodes where each song points to the next song.',
    code: `#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* next;
};

int main() {
    Node* first = new Node{10, nullptr};
    first->next = new Node{20, nullptr};

    cout << first->data << " ";
    cout << first->next->data;

    delete first->next;
    delete first;
    return 0;
}`,
    question: 'What does the head pointer of a linked list store?',
    options: ['Address of the first node', 'Address of the last node only', 'Number of nodes', 'The sum of all nodes'],
    answer: 0,
    explanation: 'The head pointer stores the address of the first node. An empty list generally has head = nullptr.',
  },
  Stacks: {
    introduction: 'A stack is a linear data structure that follows the Last In, First Out (LIFO) principle. The most recently inserted element is removed first.',
    notes: [
      'push inserts an element at the top.',
      'pop removes the top element.',
      'top or peek reads the top element without removing it.',
      'Push, pop and peek are O(1) operations in a typical implementation.',
      'Stacks are used in function calls, recursion, undo operations and expression evaluation.',
      'Popping an empty stack causes underflow; pushing into a full fixed-capacity stack can cause overflow.',
    ],
    example: 'A stack of plates is a familiar example: the last plate placed on top is the first one removed.',
    code: `#include <iostream>
#include <stack>
using namespace std;

int main() {
    stack<int> st;
    st.push(10);
    st.push(20);

    cout << st.top() << endl; // 20
    st.pop();
    cout << st.top() << endl; // 10
    return 0;
}`,
    question: 'Which principle does a stack follow?',
    options: ['FIFO', 'LIFO', 'Random access', 'Priority order'],
    answer: 1,
    explanation: 'A stack follows Last In, First Out: the newest item is removed first.',
  },
  Queues: {
    introduction: 'A queue is a linear data structure that follows the First In, First Out (FIFO) principle. The first inserted element is the first one removed.',
    notes: [
      'Enqueue inserts an element at the rear.',
      'Dequeue removes an element from the front.',
      'Front and rear identify the ends used for deletion and insertion.',
      'A circular queue reuses freed positions in a fixed-size array.',
      'A deque supports insertion and deletion at both ends.',
      'A priority queue removes elements according to priority rather than simple arrival order.',
    ],
    example: 'People waiting at a ticket counter form a queue: the person who arrives first is generally served first.',
    code: `#include <iostream>
#include <queue>
using namespace std;

int main() {
    queue<int> q;
    q.push(10);
    q.push(20);

    cout << q.front() << endl; // 10
    q.pop();
    cout << q.front() << endl; // 20
    return 0;
}`,
    question: 'Which element is removed first from a standard queue?',
    options: ['Last inserted', 'Highest value', 'First inserted', 'Middle element'],
    answer: 2,
    explanation: 'A standard queue follows FIFO, so the first inserted element is removed first.',
  },
  Trees: {
    introduction: 'A tree is a non-linear hierarchical data structure made of nodes connected by edges. It has a root node and parent-child relationships, and a tree with n nodes has n - 1 edges.',
    notes: [
      'The root is the topmost node and has no parent.',
      'A leaf node has no children.',
      'The depth of a node is the number of edges from the root to that node.',
      'A binary tree has at most two children per node.',
      'A Binary Search Tree orders values so smaller keys are in the left subtree and larger keys are in the right subtree, subject to its duplicate policy.',
      'Common traversals are preorder, inorder, postorder and level order.',
      'A balanced search tree aims to keep operations efficient, commonly around O(log n).',
    ],
    example: 'A folder hierarchy on a computer resembles a tree: folders can contain subfolders and files.',
    code: `#include <iostream>
using namespace std;

struct Node {
    int data;
    Node* left;
    Node* right;
};

void inorder(Node* root) {
    if (root == nullptr) return;
    inorder(root->left);
    cout << root->data << " ";
    inorder(root->right);
}

int main() {
    Node* root = new Node{2, nullptr, nullptr};
    root->left = new Node{1, nullptr, nullptr};
    root->right = new Node{3, nullptr, nullptr};

    inorder(root); // 1 2 3
    return 0;
}`,
    question: 'How many children can a binary tree node have at most?',
    options: ['1', '2', '3', 'Unlimited'],
    answer: 1,
    explanation: 'A binary tree node can have at most two children, usually called left and right.',
  },
  Graphs: {
    introduction: 'A graph is a non-linear data structure consisting of vertices (nodes) and edges (connections). Graphs model relationships and networks.',
    notes: [
      'Vertices represent entities; edges represent relationships between them.',
      'An undirected edge has no direction; a directed edge has a direction.',
      'A weighted graph assigns a cost or weight to edges.',
      'An adjacency matrix uses a 2D matrix; an adjacency list stores neighbours for each vertex.',
      'Breadth-First Search (BFS) explores level by level and commonly uses a queue.',
      'Depth-First Search (DFS) explores deeply before backtracking and uses recursion or a stack.',
      'BFS finds shortest paths by number of edges in an unweighted graph.',
    ],
    example: 'A road map can be represented as a graph: cities are vertices and roads are edges.',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int vertices = 4;
    vector<vector<int>> graph(vertices);

    graph[0].push_back(1);
    graph[0].push_back(2);
    graph[1].push_back(3);

    for (int neighbour : graph[0]) {
        cout << neighbour << " ";
    }
    return 0;
}`,
    question: 'Which data structure is commonly used by BFS?',
    options: ['Stack', 'Queue', 'Heap', 'Binary Search Tree'],
    answer: 1,
    explanation: 'BFS uses a queue to visit vertices in the order they are discovered.',
  },
  'Dynamic Programming': {
    introduction: 'Dynamic Programming (DP) is a problem-solving technique that solves a problem by combining solutions to overlapping subproblems and storing results to avoid repeated work.',
    notes: [
      'DP is useful when a problem has overlapping subproblems and optimal substructure.',
      'Memoization is a top-down approach that stores results during recursion.',
      'Tabulation is a bottom-up approach that fills a table iteratively.',
      'Define the DP state clearly: it represents a subproblem.',
      'Write the transition that relates a state to smaller states.',
      'Identify base cases before computing larger states.',
      'Time and space complexity depend on the number of states and transitions.',
    ],
    example: 'In Fibonacci calculation, naive recursion recalculates the same values many times. DP stores each computed value and reuses it.',
    code: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    int n = 6;
    vector<int> dp(n + 1, 0);

    dp[0] = 0;
    dp[1] = 1;

    for (int i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }

    cout << dp[n];
    return 0;
}`,
    question: 'What is the main purpose of storing subproblem results in DP?',
    options: ['To repeat calculations', 'To avoid repeated work', 'To sort the input', 'To use more recursion'],
    answer: 1,
    explanation: 'DP stores already computed subproblem results so they do not need to be recalculated.',
  },
}

function makeIntroLesson(track, topic) {
  return {
    introduction: `${topic.title}: ${topic.description} This module introduces the key ideas and terminology you should understand before moving to detailed lessons and exercises.`,
    notes: [
      `Understand the meaning and purpose of ${topic.title.toLowerCase()}.`,
      `Learn the important terminology associated with ${topic.title.toLowerCase()}.`,
      'Study the underlying concepts and how they connect to the rest of the subject.',
      'Work through examples and practice questions after understanding the fundamentals.',
    ],
    example: `In the ${track.title} learning path, ${topic.title.toLowerCase()} is an important area. Connect its concepts to practical problems and real systems.`,
    code: null,
    question: `What should you do first when learning ${topic.title}?`,
    options: [
      'Memorize answers without understanding',
      'Understand the basic concepts and terminology',
      'Skip the fundamentals',
      'Start with unrelated advanced topics',
    ],
    answer: 1,
    explanation: 'Understanding the basic concepts and terminology creates a foundation for solving more advanced problems.',
  }
}

export default function StudyHubTab({ onNavigateTab }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [completedTopics, setCompletedTopics] = useState(() => {
    try {
      const saved = localStorage.getItem('brainvash_completed_topics')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('brainvash_completed_topics', JSON.stringify(completedTopics))
    } catch {
      // Keep the UI usable if browser storage is unavailable.
    }
  }, [completedTopics])

  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return tracks.filter((track) => {
      const matchesCategory = activeCategory === 'All' || track.category === activeCategory
      const searchableText = [
        track.title,
        track.category,
        track.topics,
        ...track.topicList.map((topic) => topic.title),
      ].join(' ').toLowerCase()
      return matchesCategory && searchableText.includes(query)
    })
  }, [searchQuery, activeCategory])

  const openTrack = (track) => {
    setSelectedTrack(track)
    setSelectedTopic(null)
    setSelectedAnswer(null)
  }

  const openTopic = (topic) => {
    setSelectedTopic(topic)
    setSelectedAnswer(null)
  }

  const goBackToTopics = () => {
    setSelectedTopic(null)
    setSelectedAnswer(null)
  }

  const currentTopicKey = selectedTrack && selectedTopic
    ? `${selectedTrack.id}-${selectedTopic.title}`
    : ''
  const currentLesson = selectedTrack && selectedTopic
    ? (selectedTrack.id === 'dsa' && dsaLessons[selectedTopic.title])
    || makeIntroLesson(selectedTrack, selectedTopic)
    : null
  const isCurrentTopicCompleted = currentTopicKey
    ? completedTopics.includes(currentTopicKey)
    : false

  const markTopicCompleted = () => {
    if (!currentTopicKey || isCurrentTopicCompleted) return
    setCompletedTopics((previous) => [...previous, currentTopicKey])
  }

  // Topic learning page
  if (selectedTopic && selectedTrack && currentLesson) {
    const completedCount = selectedTrack.topicList.filter((topic) =>
      completedTopics.includes(`${selectedTrack.id}-${topic.title}`)
    ).length

    return (
      <div className="dash-tab-container">
        <button type="button" className="btn-primary" onClick={goBackToTopics}>
          ← Back to Topics
        </button>

        <div style={{ marginTop: 24 }}>
          <span className="dash-quiz-subject">{selectedTrack.title}</span>
          <h1 className="dash-page-title" style={{ marginTop: 12 }}>
            {selectedTopic.title}
          </h1>
          <p className="dash-page-desc">{selectedTopic.description}</p>
          <p className="dash-page-desc" style={{ marginTop: 8 }}>
            Track progress: {completedCount} of {selectedTrack.topicList.length} topics completed
          </p>
        </div>

        <section className="dash-quiz-card" style={{ marginTop: 24 }}>
          <h2>1. Introduction</h2>
          <p style={{ marginTop: 12, lineHeight: 1.8 }}>{currentLesson.introduction}</p>
        </section>

        <section className="dash-quiz-card" style={{ marginTop: 18 }}>
          <h2>2. Important Concepts & Notes</h2>
          <ul style={{ paddingLeft: 22, marginTop: 12, lineHeight: 2 }}>
            {currentLesson.notes.map((note, index) => <li key={index}>{note}</li>)}
          </ul>
        </section>

        <section className="dash-quiz-card" style={{ marginTop: 18 }}>
          <h2>3. Practical Example</h2>
          <p style={{ marginTop: 12, lineHeight: 1.8 }}>{currentLesson.example}</p>
        </section>

        {currentLesson.code && (
          <section className="dash-quiz-card" style={{ marginTop: 18 }}>
            <h2>4. C++ Code Example</h2>
            <p style={{ marginTop: 8 }}>A simple introductory implementation:</p>
            <pre style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 10,
              overflowX: 'auto',
              background: '#241f2b',
              color: '#f5f0e8',
              fontSize: 13,
              lineHeight: 1.7,
            }}>
              <code>{currentLesson.code}</code>
            </pre>
          </section>
        )}

        <section className="dash-quiz-card" style={{ marginTop: 18 }}>
          <h2>{currentLesson.code ? '5.' : '4.'} Quick Practice</h2>
          <p style={{ margin: '14px 0' }}>{currentLesson.question}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {currentLesson.options.map((option, index) => {
              const isSelected = selectedAnswer === index
              const isCorrect = index === currentLesson.answer
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSelectedAnswer(index)}
                  style={{
                    textAlign: 'left',
                    padding: 13,
                    borderRadius: 9,
                    border: isSelected
                      ? `2px solid ${isCorrect ? '#26834a' : '#a9473e'}`
                      : '1px solid var(--border-color, #ddd)',
                    background: isSelected
                      ? (isCorrect ? 'rgba(38,131,74,0.09)' : 'rgba(169,71,62,0.08)')
                      : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </button>
              )
            })}
          </div>

          {selectedAnswer !== null && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontWeight: 700 }}>
                {selectedAnswer === currentLesson.answer ? 'Correct answer!' : 'Not quite. Review the explanation.'}
              </p>
              <p style={{ marginTop: 8, lineHeight: 1.7 }}>{currentLesson.explanation}</p>
            </div>
          )}
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 22 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={isCurrentTopicCompleted}
            onClick={markTopicCompleted}
          >
            {isCurrentTopicCompleted ? '✓ Topic Completed' : 'Mark as Completed'}
          </button>
          <button type="button" className="btn-primary" onClick={goBackToTopics}>
            Back to Learning Roadmap
          </button>
        </div>
      </div>
    )
  }

  // Track detail page
  if (selectedTrack) {
    const completedCount = selectedTrack.topicList.filter((topic) =>
      completedTopics.includes(`${selectedTrack.id}-${topic.title}`)
    ).length
    const totalTopics = selectedTrack.topicList.length
    const progress = totalTopics ? Math.round((completedCount / totalTopics) * 100) : 0
    const nextTopic = selectedTrack.topicList.find(
      (topic) => !completedTopics.includes(`${selectedTrack.id}-${topic.title}`)
    )

    return (
      <div className="dash-tab-container">
        <button
          type="button"
          onClick={() => {
            setSelectedTrack(null)
            setSelectedTopic(null)
          }}
          className="btn-primary"
          style={{ marginBottom: 24 }}
        >
          ← Back to Study Hub
        </button>

        <div className="dash-tab-header">
          <div>
            <span className="dash-quiz-subject">{selectedTrack.category}</span>
            <h1 className="dash-page-title" style={{ marginTop: 12 }}>
              {selectedTrack.icon} {selectedTrack.title}
            </h1>
            <p className="dash-page-desc">{selectedTrack.description}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '20px 0' }}>
          <div className="dash-quiz-card">
            <strong>Learning Level</strong>
            <p className="dash-page-desc">{selectedTrack.level}</p>
          </div>
          <div className="dash-quiz-card">
            <strong>Estimated Duration</strong>
            <p className="dash-page-desc">{selectedTrack.duration}</p>
          </div>
          <div className="dash-quiz-card">
            <strong>Topics Completed</strong>
            <p className="dash-page-desc">{completedCount} / {selectedTrack.topicList.length}</p>
          </div>
        </div>

        <section className="dash-quiz-card" style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <strong>Track Progress</strong>
            <strong>{progress}%</strong>
          </div>
          <div style={{ height: 9, background: 'var(--border-color, #e5e5e5)', borderRadius: 99, overflow: 'hidden', marginTop: 12 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: '#a9473e', borderRadius: 99, transition: 'width 0.2s ease' }} />
          </div>
        </section>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={!nextTopic}
            onClick={() => {
              if (!nextTopic) return
              setSelectedTopic(nextTopic)
              setSelectedAnswer(null)
            }}
          >
            {nextTopic ? (completedCount > 0 ? 'Continue Learning →' : 'Start Learning →') : '✓ Track Completed'}
          </button>
          <span className="dash-page-desc">
            {nextTopic
              ? `${completedCount} of ${totalTopics} topics completed. Next: ${nextTopic.title}`
              : 'You have completed every topic in this track.'}
          </span>
        </div>

        <h2 style={{ margin: '28px 0 16px' }}>Learning Roadmap</h2>
        <p className="dash-page-desc" style={{ marginBottom: 20 }}>
          Select a topic to read its introduction, notes, practical example and quick practice question.
        </p>

        <div className="dash-quizzes-grid">
          {selectedTrack.topicList.map((topic, index) => {
            const done = completedTopics.includes(`${selectedTrack.id}-${topic.title}`)
            const hasFullLesson = selectedTrack.id === 'dsa' && Boolean(dsaLessons[topic.title])
            return (
              <button
                type="button"
                className="dash-quiz-card"
                key={topic.title}
                onClick={() => openTopic(topic)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  color: 'inherit',
                  cursor: 'pointer',
                  font: 'inherit',
                }}
              >
                <div className="dash-quiz-top">
                  <span className="dash-quiz-subject">TOPIC {index + 1}</span>
                  <span className="dash-quiz-diff diff-medium">
                    {done ? 'Completed' : hasFullLesson ? 'Lesson Available' : 'Introduction'}
                  </span>
                </div>
                <h3 className="dash-quiz-title">{topic.title}</h3>
                <p className="dash-quiz-desc">{topic.description}</p>
                <p style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#a9473e' }}>
                  Open Lesson →
                </p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Study Hub main page
  return (
    <div className="dash-tab-container">
      <div className="dash-tab-header">
        <div>
          <h1 className="dash-page-title">Study Hub & Curriculum Tracks</h1>
          <p className="dash-page-desc">
            Curated subject notes, cheat sheets, and targeted practice roadmaps for engineering students.
          </p>
        </div>
      </div>

      <div className="dash-study-notice-card">
        <div className="dash-study-notice-icon">📚</div>
        <div className="dash-study-notice-text">
          <h3>Explore Your Learning Roadmaps</h3>
          <p>
            Open a track to explore topic introductions, key concepts, examples and practice questions. More detailed learning resources will be added progressively.
          </p>
          <button
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => onNavigateTab('quizzes')}
          >
            Practice Available Quizzes →
          </button>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search subjects, topics or tracks..."
          aria-label="Search study tracks"
          style={{
            width: '100%',
            maxWidth: 500,
            padding: '12px 16px',
            border: '1px solid var(--border-color, #ddd)',
            borderRadius: 10,
            fontSize: 14,
            background: 'var(--card-bg, #fff)',
            color: 'inherit',
            marginBottom: 16,
          }}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          {categories.map((category) => {
            const isActive = activeCategory === category
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={isActive}
                style={{
                  padding: '8px 15px',
                  borderRadius: 20,
                  border: isActive ? '1px solid #a9473e' : '1px solid var(--border-color, #ddd)',
                  background: isActive ? '#a9473e' : 'transparent',
                  color: isActive ? '#fff' : 'inherit',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {category === 'All' ? 'All Tracks' : category}
              </button>
            )
          })}
        </div>

        <p className="dash-page-desc" style={{ marginBottom: 12 }}>
          Showing {filteredTracks.length} of {tracks.length} study tracks
        </p>
      </div>

      {filteredTracks.length > 0 ? (
        <div className="dash-quizzes-grid">
          {filteredTracks.map((track) => {
            const trackCompletedCount = track.topicList.filter((topic) =>
              completedTopics.includes(`${track.id}-${topic.title}`)
            ).length
            const trackProgress = track.topicList.length
              ? Math.round((trackCompletedCount / track.topicList.length) * 100)
              : 0

            return (
              <button
                type="button"
                className="dash-quiz-card"
                key={track.id}
                onClick={() => openTrack(track)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  font: 'inherit',
                  color: 'inherit',
                }}
              >
                <div className="dash-quiz-top">
                  <span className="dash-quiz-subject">{track.category}</span>
                  <span className="dash-quiz-diff diff-medium">{track.status}</span>
                </div>
                <h3 className="dash-quiz-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{track.icon}</span>
                  {track.title}
                </h3>
                <p className="dash-quiz-desc">{track.topics}</p>
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, marginBottom: 7 }}>
                    <span>{trackCompletedCount}/{track.topicList.length} topics completed</span>
                    <strong>{trackProgress}%</strong>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${track.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={trackProgress}
                    style={{ height: 7, background: 'var(--border-color, #e5e5e5)', borderRadius: 99, overflow: 'hidden' }}
                  >
                    <div style={{ width: `${trackProgress}%`, height: '100%', background: '#a9473e', borderRadius: 99, transition: 'width 0.2s ease' }} />
                  </div>
                </div>
                <p style={{ marginTop: 14, fontSize: 13, fontWeight: 600, color: '#a9473e' }}>
                  {trackProgress === 100 ? 'Review Track →' : 'Explore Track →'}
                </p>
              </button>
            )
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          border: '1px dashed var(--border-color, #ddd)',
          borderRadius: 12,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
          <h3>No study tracks found</h3>
          <p className="dash-page-desc">
            Try another keyword or select a different category.
          </p>
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              setSearchQuery('')
              setActiveCategory('All')
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  )
}
