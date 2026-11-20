export interface SubRule {
  id: string;
  name: string;
  formula: string;
  explanation: string;
  examples: string[];
}

export interface GrammarTopic {
  id: string;
  name: string;
  rules: SubRule[];
  isUserGenerated?: boolean;
  createdAt?: string;
  /** What the learner typed to generate this topic; lets a repeat request reuse it. */
  request?: string;
}

export const STATIC_GRAMMAR_TOPICS: GrammarTopic[] = [
  {
    id: "tenses",
    name: "Tenses",
    rules: [
      {
        id: "present-simple",
        name: "Present Simple",
        formula: "S + V(s/es)  |  S + do/does + not + V",
        explanation: "Used for habits, routines, and general truths.",
        examples: [
          "She works at a hospital.",
          "They don't eat meat.",
          "Water boils at 100C.",
        ],
      },
      {
        id: "present-continuous",
        name: "Present Continuous",
        formula: "S + am/is/are + V-ing",
        explanation: "Used for actions happening right now or temporary situations.",
        examples: [
          "He is reading a book.",
          "We are staying at a hotel this week.",
          "It is raining outside.",
        ],
      },
      {
        id: "past-simple",
        name: "Past Simple",
        formula: "S + V2  |  S + did + not + V",
        explanation: "Used for completed actions at a specific time in the past.",
        examples: [
          "I visited Paris last summer.",
          "She didn't call me yesterday.",
          "They played football on Sunday.",
        ],
      },
      {
        id: "past-perfect",
        name: "Past Perfect",
        formula: "S + had + V3",
        explanation: "Used for an action that happened before another past action.",
        examples: [
          "By the time he arrived, we had already eaten.",
          "She had never seen snow before moving to Canada.",
          "They had finished the project before the deadline.",
        ],
      },
      {
        id: "future-simple",
        name: "Future Simple",
        formula: "S + will + V",
        explanation: "Used for decisions made at the moment of speaking and predictions.",
        examples: [
          "I will call you tomorrow.",
          "It will probably rain tonight.",
          "She will be a great doctor.",
        ],
      },
    ],
  },
  {
    id: "modal-verbs",
    name: "Modal Verbs",
    rules: [
      {
        id: "can-could",
        name: "can / could",
        formula: "S + can/could + V",
        explanation:
          "'Can' expresses present ability or permission; 'could' expresses past ability or polite requests.",
        examples: [
          "She can speak three languages.",
          "Could you please open the window?",
          "When I was young, I could run very fast.",
        ],
      },
      {
        id: "may-might",
        name: "may / might",
        formula: "S + may/might + V",
        explanation:
          "Both express possibility; 'might' is slightly less certain than 'may'.",
        examples: [
          "It may rain this afternoon.",
          "He might not come to the party.",
          "You may leave early if you finish your work.",
        ],
      },
      {
        id: "must-have-to",
        name: "must / have to",
        formula: "S + must/have to + V",
        explanation:
          "'Must' expresses internal obligation; 'have to' expresses external obligation.",
        examples: [
          "You must wear a seatbelt by law.",
          "I have to submit the report by Friday.",
          "Students must not use phones during exams.",
        ],
      },
      {
        id: "should",
        name: "should",
        formula: "S + should + V",
        explanation: "Expresses advice, recommendation, or expectation.",
        examples: [
          "You should see a doctor.",
          "They should arrive by noon.",
          "We shouldn't stay up too late.",
        ],
      },
      {
        id: "would",
        name: "would",
        formula: "S + would + V",
        explanation: "Used for polite requests, conditional situations, and past habits.",
        examples: [
          "Would you like some coffee?",
          "I would travel more if I had more money.",
          "As a child, he would spend hours reading.",
        ],
      },
    ],
  },
  {
    id: "conditionals",
    name: "Conditionals",
    rules: [
      {
        id: "type-0",
        name: "Type 0 - Zero Conditional",
        formula: "If + present simple, present simple",
        explanation: "Used for general truths and scientific facts.",
        examples: [
          "If you heat water to 100C, it boils.",
          "If it rains, the ground gets wet.",
          "Plants die if they don't get water.",
        ],
      },
      {
        id: "type-1",
        name: "Type 1 - First Conditional",
        formula: "If + present simple, will + V",
        explanation: "Used for real and possible future situations.",
        examples: [
          "If it rains tomorrow, I will stay home.",
          "You will pass the exam if you study hard.",
          "If she calls, tell her I'm busy.",
        ],
      },
      {
        id: "type-2",
        name: "Type 2 - Second Conditional",
        formula: "If + past simple, would + V",
        explanation: "Used for hypothetical or unlikely present/future situations.",
        examples: [
          "If I had more time, I would travel the world.",
          "She would buy a car if she could drive.",
          "If it weren't so cold, we would go for a walk.",
        ],
      },
      {
        id: "type-3",
        name: "Type 3 - Third Conditional",
        formula: "If + past perfect, would have + V3",
        explanation: "Used to talk about impossible past situations and regrets.",
        examples: [
          "If I had studied harder, I would have passed.",
          "She wouldn't have missed the bus if she had woken up earlier.",
          "If they had known, they would have helped.",
        ],
      },
    ],
  },
  {
    id: "passive-voice",
    name: "Passive Voice",
    rules: [
      {
        id: "present-passive",
        name: "Present Simple Passive",
        formula: "S + am/is/are + V3 (+ by agent)",
        explanation:
          "Used when the focus is on the action or object rather than the doer.",
        examples: [
          "English is spoken in many countries.",
          "The report is written every month.",
          "These cars are made in Germany.",
        ],
      },
      {
        id: "past-passive",
        name: "Past Simple Passive",
        formula: "S + was/were + V3 (+ by agent)",
        explanation:
          "Used for completed past actions where the doer is unknown or unimportant.",
        examples: [
          "The window was broken last night.",
          "The letters were sent yesterday.",
          "This bridge was built in 1890.",
        ],
      },
      {
        id: "perfect-passive",
        name: "Present Perfect Passive",
        formula: "S + has/have been + V3 (+ by agent)",
        explanation: "Used when a recent action affects the present; focus on the result.",
        examples: [
          "The project has been completed.",
          "Several mistakes have been found in the report.",
          "The room has been cleaned.",
        ],
      },
    ],
  },
  {
    id: "relative-clauses",
    name: "Relative Clauses",
    rules: [
      {
        id: "defining",
        name: "Defining Relative Clauses",
        formula: "N + who/which/that + clause",
        explanation:
          "Identifies which person or thing is meant. No commas. Cannot be removed without losing meaning.",
        examples: [
          "The man who called you is my brother.",
          "This is the book that changed my life.",
          "The car which broke down is mine.",
        ],
      },
      {
        id: "non-defining",
        name: "Non-Defining Relative Clauses",
        formula: "N, + which/who + clause,",
        explanation:
          "Adds extra information. Use commas. Can be removed without changing core meaning. Never use 'that'.",
        examples: [
          "My sister, who lives in Hanoi, is a doctor.",
          "The Eiffel Tower, which was built in 1889, is very popular.",
          "He gave me a book, which I found very helpful.",
        ],
      },
    ],
  },
  {
    id: "reported-speech",
    name: "Reported Speech",
    rules: [
      {
        id: "reported-statements",
        name: "Reporting Statements",
        formula: "S + said (that) + clause (tenses shift back one step)",
        explanation:
          "When reporting what someone said, verb tenses generally shift back one step.",
        examples: [
          "'I am tired.' -> She said she was tired.",
          "'We will come.' -> They said they would come.",
          "'I have finished.' -> He said he had finished.",
        ],
      },
      {
        id: "reported-questions",
        name: "Reporting Questions",
        formula: "S + asked if/whether + clause | S + asked + wh-word + clause",
        explanation:
          "Reported questions use statement word order with no inversion and no question mark.",
        examples: [
          "'Are you coming?' -> She asked if I was coming.",
          "'Where do you live?' -> He asked where I lived.",
          "'What time is it?' -> She asked what time it was.",
        ],
      },
      {
        id: "reported-commands",
        name: "Reporting Commands",
        formula: "S + told/asked + O + to + V",
        explanation:
          "Imperatives are reported using 'told' for commands or 'asked' for requests followed by the infinitive.",
        examples: [
          "'Sit down.' -> She told him to sit down.",
          "'Please help me.' -> He asked her to help him.",
          "'Don't be late.' -> She told them not to be late.",
        ],
      },
    ],
  },
  {
    id: "articles",
    name: "Articles",
    rules: [
      {
        id: "a-an",
        name: "a / an (Indefinite Article)",
        formula: "a + consonant sound | an + vowel sound",
        explanation:
          "Used with singular countable nouns when mentioned for the first time or when one of many.",
        examples: [
          "She is a doctor.",
          "I saw an elephant at the zoo.",
          "Can I borrow a pen?",
        ],
      },
      {
        id: "the",
        name: "the (Definite Article)",
        formula: "the + noun (singular or plural)",
        explanation: "Used when the noun is specific, already mentioned, or unique.",
        examples: [
          "The book on the table is mine.",
          "The sun rises in the east.",
          "Please close the door.",
        ],
      },
      {
        id: "zero-article",
        name: "Zero Article",
        formula: "no article + noun",
        explanation:
          "No article is used with plural or uncountable nouns for generalizations, proper nouns, and fixed expressions.",
        examples: [
          "Dogs are loyal animals.",
          "She studies medicine at university.",
          "He goes to school by bus.",
        ],
      },
    ],
  },
  {
    id: "prepositions",
    name: "Prepositions",
    rules: [
      {
        id: "prepositions-time",
        name: "Prepositions of Time",
        formula: "at (specific time) | on (day/date) | in (month/year/period)",
        explanation:
          "'At' for clock times; 'on' for days and dates; 'in' for longer periods.",
        examples: [
          "The meeting starts at 9 o'clock.",
          "She was born on March 15th.",
          "I visited Japan in 2022.",
        ],
      },
      {
        id: "prepositions-place",
        name: "Prepositions of Place",
        formula: "at (point/location) | on (surface) | in (enclosed space)",
        explanation:
          "'At' for specific locations; 'on' for surfaces or lines; 'in' for enclosed spaces.",
        examples: [
          "She is waiting at the bus stop.",
          "The keys are on the table.",
          "He lives in Hanoi.",
        ],
      },
      {
        id: "prepositions-movement",
        name: "Prepositions of Movement",
        formula: "to (destination) | into (enclosed) | onto (surface) | through",
        explanation: "Describe direction and destination of an action.",
        examples: [
          "We walked to the park.",
          "She jumped into the swimming pool.",
          "He climbed onto the roof.",
        ],
      },
    ],
  },
];
