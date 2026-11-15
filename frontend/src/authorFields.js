export const authorFields = [
  { name: 'fullName', label: 'Full name', required: true, description: "The author's full name." },
  { name: 'knownAs', label: 'Known as', description: 'The display name used instead of the full name when provided.' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date', required: true, description: 'The date the author was born.' },
  { name: 'dateOfDeath', label: 'Date of death', type: 'date', description: 'The date the author died, if applicable.' },
  { name: 'placeOfBirth', label: 'Place of birth', description: 'Where the author was born, such as a city or country.' },
  { name: 'nationality', label: 'Nationality', description: "The author's nationality." },
  { name: 'bio', label: 'Biography', multiline: true, description: "A brief account of the author's life and work." },
]
