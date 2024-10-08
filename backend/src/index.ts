import createClient from "openapi-fetch";
import { components, paths } from "./schema";

import { fromHex, toHex, verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
// Importing and initializing DB
const { Database } = require("node-sqlite3-wasm");

import { InspectPayload, Player } from './interfaces';

import { pokemons } from "../pokemons/allpokemons.js";
import { MT19937 } from "../lib/MT19937";

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;

console.log('Will start SQLITE Database');

// Instatiate Database
const db = new Database('/tmp/database.db');
try {
  db.run('CREATE TABLE IF NOT EXISTS pokemons (id INTEGER PRIMARY KEY, name TEXT, type TEXT, hp INTEGER, attack INTEGER, defense INTEGER, speed INTEGER, atk1 TEXT, atk2 TEXT, atk3 TEXT, image TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS players (playerid INTEGER PRIMARY KEY, wallet TEXT, inventory TEXT, battles TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS hashes (hash TEXT PRIMARY KEY)');
  db.run('CREATE TABLE IF NOT EXISTS battles (id TEXT PRIMARY KEY, maker TEXT, taker TEXT)');
  db.run('CREATE TABLE IF NOT EXISTS battle_logs (id INTEGER PRIMARY KEY, battle_id TEXT, log TEXT)');

  db.run('INSERT INTO players (playerid, wallet, inventory, battles) VALUES (?, ?, ?, ?)', [1, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', '[]', '[]']);
  db.run('UPDATE players SET inventory = ? WHERE playerid = ?', ['[25,24,23,12,16]', 1]);
} catch (e) {
  console.log('ERROR initializing database: ', e)
}
console.log('Backend Database initialized');


for (let i = 0; i < 25; i++) {
  db.run('INSERT INTO pokemons (id, name, type, hp, attack, defense, speed, atk1, atk2, atk3, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [i + 1, pokemons[i]!.name, pokemons[i]!.type, pokemons[i]!.hp, pokemons[i]!.attack, pokemons[i]!.defense, pokemons[i]!.speed, pokemons[i]!.atk1, pokemons[i]!.atk2, pokemons[i]!.atk3, pokemons[i]!.image]);
}

type AdvanceRequestData = components["schemas"]["Advance"];
type InspectRequestData = components["schemas"]["Inspect"];
type RequestHandlerResult = components["schemas"]["Finish"]["status"];
type RollupsRequest = components["schemas"]["RollupRequest"];
type InspectRequestHandler = (data: InspectRequestData) => Promise<string>;
type AdvanceRequestHandler = (
  data: AdvanceRequestData
) => Promise<RequestHandlerResult>;

const rollupServer = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollupServer);

const sendReport = async (object: any) => {
  const payload = toHex(JSON.stringify({ object }));
  try {
    const inspect_req = await fetch(rollup_server + '/report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payload })
    });
    console.log("Received report status " + inspect_req.status);
    return true;
  } catch (e) {
    console.log(`Error generating report with binary value "${payload}"`);
    return false;
  }
}

const handleBattleCreation = async (maker : number) => {
  console.log(`Creating battle for ${maker}`);
  const timestamp = new Date().getTime();
  const taker = "AI";  
  const battleId = toHex(JSON.stringify({maker, timestamp}));

  db.run('INSERT INTO battles VALUES (?, ?, ?)', [battleId, maker, taker]);
}

const assignPokemon = async (playerId: number, wallet: `0x${string}`, pokemonId: number) => {
  // check if user is already registered
  const player : Player = await db.get('SELECT * FROM players WHERE playerid = ?', [playerId]);

  console.log(player);

  if(!player) {
    db.run('INSERT INTO players (playerid, wallet, inventory, battles) VALUES (?, ?, ?, ?)', [playerId, wallet, JSON.stringify([pokemonId]), '[]']);

    return { playerCreated: true };
  }
  
  const inventory = JSON.parse(player.inventory);
  inventory.push(pokemonId);
  console.log(inventory);
  db.run('UPDATE players SET inventory = ? WHERE playerid = ?', [JSON.stringify(inventory), playerId]);
  
  return { playerCreated: false };
}

const handleAdvance: AdvanceRequestHandler = async (data) => {
  console.log("Received advance request data " + JSON.stringify(data));
  const payload = data.payload;
  try {
    const advancePayload = JSON.parse(fromHex(payload, 'string'));
    console.log("Advance payload is ", advancePayload);
    const action = advancePayload.action;

    if(action === 'mint-pokemon') {
      const { senderId, senderWallet } = advancePayload;
      // const pokemonId = data.metadata.timestamp % 25 + 1;
      const mt = new MT19937(data.metadata.timestamp);
      const pokemonId = mt.randomPokemon(1,25);
      console.log(pokemonId);

      await assignPokemon(senderId, senderWallet, pokemonId);

      advancePayload.pokemonId = pokemonId;
    } else if(action === 'register-log') {
      const { battleLog, battleId } = advancePayload;

      db.run('INSERT INTO battle_logs (battle_id, log) VALUES (?, ?)', [battleId, battleLog]);
    }

    const noticePayload = toHex(JSON.stringify(advancePayload));

    const advance_req = await fetch(rollup_server + '/notice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ payload: noticePayload })
    });
    console.log("Received notice status ", await advance_req.text());
    return "accept";

  } catch (e) {
    console.log(e);
    console.log(`Error executing parameters: "${payload}"`);
    return "reject";
  }
};

const handleInspect: InspectRequestHandler = async (data) => {
  console.log("Received inspect request data " + JSON.stringify(data));
  const payload = fromHex(data.payload, 'string');
  const inspectPayload = JSON.parse(fromHex(payload as `0x${string}`, 'string')) as InspectPayload;
  const action = inspectPayload.action;

  if(action === 'create-battle') {
    const playerId = inspectPayload.senderId;
    if(playerId) {
      await handleBattleCreation(playerId);
      if(await sendReport({message: `Battle created for ${playerId}`})) return "accept"; 
    }
  } else if(action === 'get-user-pokemons') {
    const playerId = inspectPayload.senderId;
    const playerInventory = await db.all('SELECT inventory FROM players WHERE playerid = ?', [playerId]);
    console.log(`Player inventory is ${playerInventory}`);

    const player = await db.all('SELECT * FROM players WHERE playerid = ?', [playerId]);
    console.log(`Player is ${player}`);
    console.log(`Player0 is ${player[0]}`);

    if(await sendReport(playerInventory[0])) return "accept";
  }

  return "reject";
};

const main = async () => {
  const { POST } = createClient<paths>({ baseUrl: rollupServer });
  let status: RequestHandlerResult = "accept";
  while (true) {
    const { response } = await POST("/finish", {
      body: { status },
      parseAs: "text",
    });

    if (response.status === 200) {
      const data = (await response.json()) as RollupsRequest;
      switch (data.request_type) {
        case "advance_state":
          status = await handleAdvance(data.data as AdvanceRequestData);
          break;
        case "inspect_state":
          await handleInspect(data.data as InspectRequestData);
          break;
      }
    } else if (response.status === 202) {
      console.log(await response.text());
    }
  }
};

main().catch((e) => {
  console.log(e);
  process.exit(1);
});
