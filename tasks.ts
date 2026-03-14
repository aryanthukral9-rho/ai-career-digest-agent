import fs from "fs-extra";

const FILE = "./tasks.json";

export async function getTasks() {
  return await fs.readJSON(FILE);
}

export async function addTask(task: any) {
  const tasks = await getTasks();
  tasks.push(task);
  await fs.writeJSON(FILE, tasks, { spaces: 2 });
}

export async function listTasks() {
  const tasks = await getTasks();

  if (tasks.length === 0) {
    console.log("No tasks yet.");
    return;
  }

  tasks.forEach((t: any, i: number) => {
    console.log(`${i + 1}. ${t.task} (${t.date})`);
  });
}