export const characterFields = [
  {name: 'fullName', label: 'Full name', required: true, description: 'The full name of the fictional speaker, not the author.'},
  {name: 'knownAs', label: 'Known as', description: 'The display name used instead of the full name when provided.'},
  {name: 'workTitle', label: 'Work title', description: 'The title of the work in which the character appears.'},
  {name: 'description', label: 'Description', multiline: true, description: 'A brief description of the character and their role in the work.'},
]

export function characterLabel(character) {
  const name = character.knownAs || character.fullName
  return character.workTitle ? `${name} (${character.workTitle})` : name
}
