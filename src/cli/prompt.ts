import readline from "node:readline";

/**
 * Prompts the user on stdin and resolves with the trimmed answer.
 * Returns the answer lowercased. Used by the scope approval flow.
 */
export function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
