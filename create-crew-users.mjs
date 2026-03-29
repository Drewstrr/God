/**
 * create-crew-users.mjs
 * Creează toți membrii crew în Supabase Auth.
 *
 * ÎNAINTE SĂ RULEZI:
 *   1. Mergi la: https://supabase.com/dashboard/project/jdhpczzxighkydfvites/settings/api
 *   2. Copiază "service_role" key (NU anon key)
 *   3. Înlocuiește SERVICE_ROLE_KEY de mai jos cu valoarea copiată
 *   4. Rulează: node create-crew-users.mjs
 *
 * Necesită Node.js 18+ (fetch nativ).
 */

const PROJECT_URL   = 'https://jdhpczzxighkydfvites.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'PUNE_AICI_SERVICE_ROLE_KEY';

const CREW = [
  { name: 'Andrei'   },
  { name: 'Alex'     },
  { name: 'Bogdan'   },
  { name: 'Luca'     },
  { name: 'Robi'     },
  { name: 'Nico'     },
  { name: 'Cella'    },
  { name: 'Flori'    },
  { name: 'Gabriela' },
  { name: 'Andreea'  },
];

async function createUser({ name }) {
  const email    = name.toLowerCase() + '@crew.ro';
  const password = name.toLowerCase() + '2026';

  const res = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey':        SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    }),
  });

  const json = await res.json();

  if (res.ok) {
    console.log(`✅ ${name.padEnd(10)} → ${email}  (pwd: ${password})`);
  } else {
    const msg = json.msg || json.message || JSON.stringify(json);
    console.log(`❌ ${name.padEnd(10)} → EROARE: ${msg}`);
  }
}


if (SERVICE_ROLE_KEY === 'PUNE_AICI_SERVICE_ROLE_KEY') {
  console.error('⚠️  Setează env: SUPABASE_SERVICE_ROLE_KEY=<cheia> node create-crew-users.mjs');
  process.exit(1);
}

console.log('Creare utilizatori crew Zakynthos 2026...\n');
for (const member of CREW) {
  await createUser(member);
}
console.log('\nGata!');
