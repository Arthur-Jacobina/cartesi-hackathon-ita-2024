import sharp from 'sharp';
import { serveStatic } from '@hono/node-server/serve-static'
import { Button, FrameContext, Frog, parseEther } from 'frog'
import { getFarcasterUserInfo } from '../lib/neynar.js';
import { publicClient } from '../lib/contracts.js';
import { devtools } from 'frog/dev';
import { handle } from 'frog/vercel';
import { serve } from '@hono/node-server';
import { BACKEND_URL } from '../constant/config.js';
import { BlankInput } from 'hono/types';
import { assignPokemonToUser, getGameInfoByGameId, getPokemonsByPlayerId } from '../lib/database.js';
import { SHARE_INTENT, SHARE_TEXT, SHARE_EMBEDS, FRAME_URL, SHARE_GACHA, title} from '../constant/config.js';
import { boundIndex } from '../lib/utils/boundIndex.js';

type State = {
  verifiedAddresses?: `0x${string}`[];
  pfp_url: any;
  userName: any;
}

export const app = new Frog<{State: State}>({
  title,
  assetsPath: '/',
  basePath: '/api',
  initialState: {
    verifiedAddresses: [],
    pfp_url: '',
    userName: '',
  },
})

app.use('/*', serveStatic({ root: './public' }))

app.frame('/', (c) => {
  return c.res({
    title,
    image: '/pikachu.jpg',
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/verify`}>PLAY 🔴</Button>,
    ],
  })
})

app.frame('/verify', async (c) => {
  const fid = c.frameData?.fid;
  if (fid) {  
    const { verifiedAddresses } = await getFarcasterUserInfo(fid);
    if (!verifiedAddresses || verifiedAddresses.length === 0) {
      return c.res({
        title,
        image: 'https://i.imgur.com/2tRZhkQ.jpeg',
        imageAspectRatio: '1:1',
        intents: [
          <Button action={`https://verify.warpcast.com/verify/${fid}`}>VERIFY WALLET</Button>,
          <Button.Reset>RESET</Button.Reset>,
        ],
      });
    }
    c.deriveState((prevState: any) => {
      prevState.verifiedAddresses = verifiedAddresses;
    });
  }
  return c.res({
    title,
    image: '/ok.jpg',
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/battle`}>BATTLE</Button>,
    <Button action={`/pokedex/0`}>POKEDEX</Button>,
    <Button action={`/scores`}>SCORES</Button>,
    ],
  })
})

app.frame('/battle', async (c) => {
  // const { frameData } = c;
  // const fid = frameData?.fid;
  // const { verifiedAddresses } = c.previousState ? c.previousState : await getFarcasterUserInfo(fid);
  // const playerAddress = verifiedAddresses[0] as `0x${string}`;
  return c.res({
    title,
    image: '/battle.png',
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/pokemons/0/0`}>POKEMONS</Button>,
    <Button action={`/verify`}>BACK</Button>,
    ],
  })
})

app.frame('/pokemons/:pokemonId/:index', async (c) => {
  const { frameData } = c;
  const fid = frameData?.fid;
  const { verifiedAddresses } = c.previousState ? c.previousState : await getFarcasterUserInfo(fid);
  const playerAddress = verifiedAddresses[0] as `0x${string}`;
  const pokemonId = Number(c.req.param('pokemonId')) || 0;
  const playerPokemons = ['1', '2'];
  const totalPlayerPokemons = playerPokemons.length;
  const index = Number(c.req.param('index')); 
  if (index == 3) {
  return c.res({
    title,
    image: `/pokeball.gif`,
    imageAspectRatio: '1:1',
    intents: [
    <Button.Transaction action={`/battle/handle/0/0x`} target='/mint'>✅</Button.Transaction>,
    <Button action={`/`}>BACK 🏠</Button>,
    ],
  })
} if (pokemonId == 0) {
  return c.res({
    title,
    image: `/${playerPokemons[pokemonId]}.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/pokemons/${boundIndex(pokemonId - 1, totalPlayerPokemons)}/${index}`}>⬅️</Button>,
    <Button action={`/pokemons/${boundIndex(pokemonId + 1, totalPlayerPokemons)}/${index}`}>➡️</Button>,
    <Button action={`/pokemons/${boundIndex(pokemonId, totalPlayerPokemons)}/${index+1}`}>✅</Button>,
    <Button action={`/`}>BACK 🏠</Button>,
    ],
  })
} else {
  return c.res({
    title,
    image: `/${playerPokemons[pokemonId]}.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/pokemons/${boundIndex(pokemonId - 1, totalPlayerPokemons)}/${index}`}>⬅️</Button>,
    <Button action={`/pokemons/${boundIndex(pokemonId + 1, totalPlayerPokemons)}/${index}`}>➡️</Button>,
    <Button action={`/pokemons/${boundIndex(pokemonId, totalPlayerPokemons)}/${index+1}`}>✅</Button>,
    <Button action={`/`}>BACK 🏠</Button>,
    ],
  })
}
})

app.frame('/battle/handle/:gameId/:txid', async (c) => {
  const { frameData } = c;
  const fid = frameData?.fid;
  const { verifiedAddresses } = c.previousState ? c.previousState : await getFarcasterUserInfo(fid);
  const playerAddress = verifiedAddresses[0] as `0x${string}` || "0xSug0u";
  let gameId = c.req.param('gameId') as `0x${string}`;
  const txId = c.req.param('txid');
  if (c.transactionId === undefined && txId === undefined) return c.error({ message: 'No txId' });
  let transactionReceipt;

  if (txId !== '0x') {
    c.transactionId = txId as `0x${string}`;
  
    try {
      transactionReceipt = await publicClient.getTransactionReceipt({
        hash: txId as `0x${string}`,
      });
      if (transactionReceipt && transactionReceipt.status == 'reverted') {
        return c.error({ message: 'Transaction failed' });
      }
    } catch (error) {
      console.log(error)
    }
  }
  if (transactionReceipt?.status === 'success') {
  gameId = txId as `0x${string}` + playerAddress;   
  return c.res({
    title,
    image: `/ok.jpg`,
    imageAspectRatio: '1:1',
    intents: [
    <Button.Link href={`${SHARE_INTENT}${SHARE_TEXT}${SHARE_EMBEDS}${FRAME_URL}/battle/handle/${gameId}/${c.transactionId}`}>SHARE</Button.Link>,
    <Button action={`/battle/${gameId}`}>REFRESH</Button>,
    ],
  })
  }
  gameId = '0x';
  return c.res({
    title,
    image: `/1.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/battle/handle/${gameId}/${c.transactionId}`}>REFRESH</Button>,
    ],
  })
})


// app.frame('/battle/random', async(c) => {
//   const { frameData } = c;
//   const fid = frameData?.fid;
//   const { verifiedAddresses } = c.previousState ? c.previousState : await getFarcasterUserInfo(fid);

//   const address = verifiedAddresses[0] as `0x${string}`;

//   const response = await fetch(
//     `${BACKEND_URL!}/war/getRandomChallengableGame?exept_maker=${address}`,
//     {
//       method: 'GET',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     },
//   );
//   const game = await response.json();
//   if (!game.game_id) return c.error({ message: 'No game found' });

//   return await battleFrame(c, game.game_id);
// })

//render pokemon active pokemons and basic stats (hp) 
app.frame('/battle/:gameId', async (c) => {
  const gameId = c.req.param('gameId') as string;
  return await battleFrame(c, gameId);
});

const battleFrame = async(
  c: FrameContext<
    {
      State: State;
    },
    '/battle/:gameId' | '/battle/random',
    BlankInput
  >, 
  gameId: string
) => {
//   let gameInfo = await getGameInfoByGameId(gameId);

//   if(!gameInfo) {
//     return c.res({
//       title,
//       image: 'https://i.imgur.com/R0qW9mo.png',
//       imageAspectRatio: '1:1',
//       intents: [<Button action="/">BACK</Button>],
//     })
//   }

//   const gameName = gameInfo[0].name;

  return c.res({
    title,
    image: 'https://i.imgur.com/Izd0SLP.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action={`/battle/${gameId}/fight`}>FIGHT</Button>,
      <Button action={`/battle/${gameId}/pokemon`}>POKEMON</Button>,
      <Button action={`/battle/${gameId}/run`}>RUN</Button>
    ]
  })
}

// app.frame('/battle/:gameId/fight', async (c) => {
//   const gameId = c.req.param('gameId') as string;
//   // const img = await generateGame(`pikachu`,`chupacu`,10,20,30,50);
//   return c.res({
//     title,
//     image: 'https://i.imgur.com/Izd0SLP.png',
//     imageAspectRatio: '1:1',
//     intents: [
//       <Button action={`/battle/${gameId}`}>1</Button>,
//       <Button action={`/battle/${gameId}`}>2</Button>,
//       <Button action={`/battle/${gameId}`}>3</Button>,
//       <Button action={`/battle/${gameId}`}>↩️</Button>
//     ]
//   })
// });

app.frame('/imgtest2', async (c) => {
  const gameId = c.req.param('gameId') as string;
  const img = await generateGame(`pikachu`,`chupacu`,10,20,30,50);
  console.log(img);
  return c.res({
    title,
    image: 'https://i.imgur.com/Izd0SLP.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action={`/battle/${gameId}`}>1</Button>,
      <Button action={`/battle/${gameId}`}>2</Button>,
      <Button action={`/battle/${gameId}`}>3</Button>,
      <Button action={`/battle/${gameId}`}>↩️</Button>
    ]
  })
});

app.hono.get('/imgtest', async (c) => {
  // const params = JSON.parse(decodeURIComponent(c.req.param('params')));

  // const { message, quantities, address } = params;
  console.log("asdadadsa")

  const image = await generateGame(`pikachu`,`chupacu`,10,20,30,50);

  console.log(image)

  return c.newResponse(image, 200, { 'Content-Type': '/png' });
});

app.frame('/battle/:gameId/pokemon', async (c) => {
  const gameId = c.req.param('gameId') as string;
  return c.res({
    title,
    image: 'https://i.imgur.com/Izd0SLP.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action={`/battle/${gameId}`}>🔄️</Button>,
      <Button action={`/battle/${gameId}`}>ENEMY 🔎</Button>,
      <Button action={`/battle/${gameId}`}>↩️</Button>
    ]
  })
});

app.frame('/battle/:gameId/run', async (c) => {
  const gameId = c.req.param('gameId') as string;
  return c.res({
    title,
    image: '/RUN.png',
    imageAspectRatio: '1:1',
    intents: [
      <Button action={`/battle/${gameId}`}>NO</Button>,
      <Button action={`/battle/${gameId}`}>YES</Button>,
    ]
  })
});

app.frame('/pokedex/:id', async (c) => {
  const { frameData } = c;
  const fid = frameData?.fid;
  const { verifiedAddresses } = c.previousState ? c.previousState : await getFarcasterUserInfo(fid);
  const playerAddress = verifiedAddresses[0] as `0x${string}`;
  const playerPokemons = await getPokemonsByPlayerId(fid!);
  const id = Number(c.req.param('id')) || 0;
  const totalPlayerPokemons = playerPokemons.length;

  return c.res({
    title,
    image: `/${playerPokemons[boundIndex(id+1, totalPlayerPokemons)]}.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/pokedex/${playerPokemons[boundIndex(id-1, totalPlayerPokemons)]}`}>⬅️</Button>,
    <Button action={`/pokedex/${playerPokemons[boundIndex(id+1, totalPlayerPokemons)]}`}>➡️</Button>,
    <Button action={`/verify`}>OK ✅</Button>,
    <Button action={`/new`}>NEW 🎲</Button>,
    ],
  })
})

app.frame('/new', (c) => {
  const pokemonId = 2; //random number
  return c.res({
    title,
    image: '/gacha.jpg',
    imageAspectRatio: '1:1',
    intents: [
    <Button.Transaction action={`/loading/${pokemonId}`} target={`/mint`}>CAPTURE 🍀</Button.Transaction>,
    <Button action={`/`}>BACK</Button>,
    ],
  })
})

app.frame('/loading/:pokemonId', async (c) => {
  const pokemonId = c.req.param('pokemonId');

  const txId = c.transactionId ? c.transactionId : '0x';
  const fid = c.frameData?.fid;

  if (txId !== '0x') {
    try {
      const transactionReceipt = await publicClient.waitForTransactionReceipt({
        hash: txId as `0x${string}`,
      });

      console.log(transactionReceipt);

      if (transactionReceipt && transactionReceipt.status == 'reverted') {
        return c.error({ message: 'Transaction failed' });
      }

      if (transactionReceipt?.status === 'success') {
        // add a function to create a new pokemon for the user in our backend
        const data = await assignPokemonToUser(fid!, txId as `0x${string}`, Number(pokemonId))
        console.log(data);

        return c.res({
          title,
          image: `/pokeball.gif`,
          imageAspectRatio: '1:1',
          intents: [
            <Button action={`/gotcha/${pokemonId}`}>CATCH</Button>,
            <Button action={`/`}>RESET</Button>,
          ],
        })
      }
    } catch (error) {
      console.log(error)
    }
  }
  return c.res({
    title,
    image: `/loading.gif`,
    imageAspectRatio: '1:1',
    intents: [
      <Button action={`/loading/${pokemonId}`}>REFRESH 🔄️</Button>,
    ],
  })
})

//// @todo ////
// -> mint a NFT on the mainnet for the appContract address 
// -> associate the user to the pokemon in our database (cartesi) 
// -> associate ownership to the user when he withdraws his NFT
app.transaction('/mint', (c) => {
  const mintCost  = '0.000777'; 
  return c.send({
    chainId: 'eip155:11155111',
    to: '0x02f37D3C000Fb5D2A824a3dc3f1a29fa5530A8D4',
    value: parseEther(mintCost as string),
  })
})

app.transaction('/create-battle', (c) => {
  const cost = '0.000777';
  return c.send({
    chainId: 'eip155:11155111',
    to: '0x02f37D3C000Fb5D2A824a3dc3f1a29fa5530A8D4',
    value: parseEther(cost as string),
  })
})

app.frame('/gotcha/:pokemonId', (c) => {
  const pokemonId = c.req.param('pokemonId');
  return c.res({
    title,
    image: `/${pokemonId}.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button.Link href={`${SHARE_INTENT}${SHARE_GACHA}${SHARE_EMBEDS}${FRAME_URL}/share/${pokemonId}`}>SHARE</Button.Link>,
    <Button action={`/`}>HOME 🏠</Button>,
    ],
  })
})

app.frame('/share/:pokemonId', (c) => {
  const pokemonId = c.req.param('pokemonId');
  return c.res({
    title,
    image: `/${pokemonId}.png`,
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/`}>TRY IT OUT 🏠</Button>,
    ],
  })
})

//// @todo ////
app.frame('/scores', (c) => {
  return c.res({
    title,
    image: 'https://i.imgur.com/2tRZhkQ.jpeg',
    imageAspectRatio: '1:1',
    intents: [
    <Button action={`/`}>RESET</Button>,
    ],
  })
})


/////////////////////
function gameComponents() {
  const components = [];
  
  console.log("CP1")
  const pokemon1 = Buffer.from(`
    <svg width="202" height="37">
    <text x="275" y="65" text-anchor="end" font-family="Arial" font-size="40" fill="white">aaaaa</text>
    </svg>
    `);
    
    const pokemon2 = Buffer.from(`
    <svg width="202" height="37">
    <text x="55" y="43" text-anchor="end" font-family="Arial" font-size="40" fill="white">$aaaaa</text>
    </svg>
    `);
    
    components.push({
      input: pokemon1,
      top: 355,
      left: 275,
    });

    components.push({
    input: pokemon2,
    top: 43,
    left: 55,
  });
  
  console.log("CP2")
  const card1 = Buffer.from(`
    <svg width="300" height="120">
      <rect x="1.5" y="1.5" width="297" height="117" rx="23.5" fill="#3D3359" stroke="#5A534B" stroke-width="3"/>
    </svg>
  `);
    
  const card2 = Buffer.from(`
    <svg width="300" height="120">
      <rect x="1.5" y="1.5" width="297" height="117" rx="23.5" fill="#3D3359" stroke="#5A534B" stroke-width="3"/>
    </svg>
  `);
    
  components.push({
    input: card1,
    top: 355,
    left: 40,
  });
  
  components.push({
    input: card2,
    top: 45,
    left: 40,
  });
   
  console.log("dasadasdasdasd")
  return components;
  
}

const generateGame = async (pokemon1Name: string, pokemon2Name: string, totalHP1: number, currentHp1: number, totalHP2: number, currentHp2: number) => {
  const baseImage = await sharp('./public/pokemon-battle.png').resize(
    599,
    599,
  );
  
  const game = gameComponents()
  
  const pokemon1Image = await sharp('./public/1.png').resize(
    200,
    200,
  ).png().toBuffer();
  
  const pokemon2Image = await sharp('./public/2.png').resize(
    200,
    200,
  ).png().toBuffer();
  
  console.log("pkboeprjk")

  // game.push(
  //   { input: pokemon1Image, top: 355, left: 40 }
  // )
  // game.push(
  //   { input: pokemon2Image, top: 45, left: 372 }
  // )

  const finalImage = await baseImage
    .composite(game)
    .png()
    .toBuffer();

    console.log(finalImage);
  return finalImage;
};


if (process.env.NODE_ENV !== 'production') {
  devtools(app, { serveStatic });
}

serve({ fetch: app.fetch, port: Number(process.env.PORT) || 5173 });
console.log(`Server started: ${new Date()} `);

export const GET = handle(app)
export const POST = handle(app)
