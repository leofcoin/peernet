import inquirer from 'inquirer'

export default async () => {
  const answers = await inquirer.prompt({ type: 'password', name: 'password', message: 'Enter password' })
  return answers.password
}
