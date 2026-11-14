export const characterFields = [
  {name: 'fullName', label: 'Full name', required: true},
  {name: 'knownAs', label: 'Known as'},
  {name: 'workTitle', label: 'Work title'},
  {name: 'description', label: 'Description', multiline: true},
]

export function characterLabel(character) {
  const name = character.knownAs || character.fullName
  return character.workTitle ? `${name} (${character.workTitle})` : name
}
