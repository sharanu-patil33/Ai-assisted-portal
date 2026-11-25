'use strict';
// Shared test data: course material used by the suite.

const EXT_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
};

/** Build an upload payload. `pages` = text of each page (or slide / whole text file as one page). */
function makeFile(name, pages, extra = {}) {
  const ext = name.split('.').pop().toLowerCase();
  return {
    name,
    detectedType: EXT_TYPES[ext] || 'application/octet-stream', // type detected from content, not the extension
    sizeBytes: 1024,
    pages,
    scanned: false,
    corrupted: false,
    imageCount: 0,
    ...extra,
  };
}

// Course A: Data Structures
const DS = [
  'A stack is a linear data structure that follows the LIFO principle. Push adds an element and pop removes the top element.',
  'A queue is a linear data structure that follows the FIFO principle. Enqueue adds an element at the rear and dequeue removes an element from the front.',
  'A binary search tree stores smaller keys in the left subtree and larger keys in the right subtree.',
  'Binary search finds a target in a sorted array in logarithmic time by halving the search range.',
];
const SORTING = [
  'This chapter introduces sorting algorithms.',
  'Merge sort divides the array into two halves.',
  'The merge step combines the sorted halves.',
  'Quick sort selects a pivot element and partitions the array.',
];
const HASHING = [
  'Hashing maps keys to array indexes using a hash function. Collisions are handled by chaining or open addressing.',
];
// Course B: Operating Systems
const OS = [
  'A process is a program in execution. The scheduler selects the next process using round robin scheduling.',
  'Deadlock occurs when processes wait for each other forever. The four necessary conditions are mutual exclusion, hold and wait, no preemption and circular wait.',
];

module.exports = { EXT_TYPES, makeFile, DS, SORTING, HASHING, OS };
