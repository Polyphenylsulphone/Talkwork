import bcrypt from 'bcryptjs';
import { query, execute } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const hash = await bcrypt.hash('demo12345', 10);
  try {
    await execute(
      'INSERT INTO users (username, student_no, email, password_hash, college) VALUES (?,?,?,?,?)',
      ['demo', 'demo', 'demo@example.invalid', hash, 'engineering']
    );
  } catch (e) {
    if (e.code !== 'ER_DUP_ENTRY') throw e;
  }
  const rows = await query('SELECT id FROM users WHERE username = ? LIMIT 1', ['demo']);
  const uid = rows[0].id;

  const [{ n }] = await query('SELECT COUNT(*) AS n FROM posts');
  if (Number(n) > 0) {
    console.log('Seed skip: posts exist');
    return;
  }

  const samples = [
    {
      title: '第一次实习面试好紧张，有什么温柔的小建议吗？',
      content: '<p>下周要去一家小厂做前端实习面试，总觉得自己准备不够，想听听大家的经验。</p>',
      type: 'question',
      college: 'engineering',
    },
    {
      title: '把「项目经历」写得更有温度的几个小技巧',
      content: '<p>比起堆栈，面试官更想看到你的思考与成长。试着用 STAR 讲一个小故事吧。</p>',
      type: 'article',
      college: 'liberal',
    },
    {
      title: '算法题总是卡住，如何调整心态？',
      content: '<p>理科背景，刷题容易焦虑。想问问大家怎么安排节奏更舒服。</p>',
      type: 'question',
      college: 'science',
    },
  ];

  for (const s of samples) {
    await execute(
      'INSERT INTO posts (user_id, title, content, post_type, college) VALUES (?,?,?,?,?)',
      [uid, s.title, s.content, s.type, s.college]
    );
  }
  console.log('Seed done. user: demo / demo12345');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
