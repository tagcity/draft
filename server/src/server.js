//@ts-check
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as debug from 'debug';
import { fetchImages } from './archillect.js';

const d = debug('server');

async function main() {
  const PORT = 1337;
  const MAX_SOCKETS = 4;
  const MAX_ROUNDS = 2;
  const images = await fetchImages(MAX_SOCKETS * MAX_ROUNDS);
  const RESOURCES = new Map(images.map((img, idx) => [idx, img]));

  const states = {
    IDLE: 'idle',
    IN_PROGRESS: 'in-progress',
    COMPLETE: 'complete',
  };

  let STATE = states.IDLE;
  let ORDER;
  let TURN = 0;
  let ROUND = 0;

  d(`Starting server on port ${PORT}`);
  const wss = new WebSocketServer({ port: PORT });
  const clients = new Map();

  const messages = {
    START: 'start',
  };

  wss.on('connection', function connection(ws) {
    if (clients.size === MAX_SOCKETS) {
      d(`Max socket count ${MAX_SOCKETS} reached`);
      ws.send(`Public health mandate says only ${MAX_SOCKETS} clients allowed. Goodbye.`);
      ws.terminate();
    }
    const metadata = {
      id: uuidv4(),
      picks: new Set(),
    };
    d('New connection added: %O', metadata);
    clients.set(ws, metadata);

    // send a welcome message
    const playerId = clients.get(ws).id;
    broadcast(`Player ${playerId} has joined.`);

    // listeners
    ws.on('close', function close(code, reason) {
      const playerId = clients.get(this).id;
      clients.delete(this);
      d('Client disconnected: %s', playerId);
    });

    ws.on('message', function incoming(message) {
      d('Received message: %s', message);

      if (message.toString() === messages.START && STATE === states.IDLE) {
        ORDER = Array.from(clients.keys());
        broadcast('COMMENCING');
        broadcast(`TURN ORDER ${ORDER}`);
        turnAction();
        STATE = states.IN_PROGRESS;
      } else if (
        STATE === states.IN_PROGRESS &&
        !Number.isNaN(Number(message)) &&
        this === ORDER[TURN] &&
        RESOURCES.has(Number(message))
      ) {
        const { picks, id } = clients.get(this);
        const num = Number(message);
        broadcast(`Player ${id} has chosen ${num}.`);
        picks.add(RESOURCES.get(num));
        RESOURCES.delete(num);
        TURN = (TURN + 1) % clients.size;
        turnAction();
      }
    });
  });

  function turnAction() {
    if (TURN === 0 && STATE === states.IN_PROGRESS) {
      ROUND++;
      if (ROUND === MAX_ROUNDS) {
        d('Reached MAXROUNDS (%s), ending draft', MAX_ROUNDS);
        STATE = states.COMPLETE;
        broadcast('DRAFT COMPLETE');
        for (const metadata of clients.values()) {
          broadcast(`Player ${metadata.id} has selected ${Array.from(metadata.picks)}`);
        }
        return;
      }
    }
    const players = Array.from(clients.values());
    broadcast(
      `ROUND ${ROUND + 1} OF ${MAX_ROUNDS} | TURN ${TURN + 1} | Player ${
        players[TURN].id
      } chooses.`,
    );
    broadcast(`Assets remaining: ${JSON.stringify(Object.fromEntries(RESOURCES), null, 2)}`);
  }

  /**
   *
   * @param {string} data
   */
  function broadcast(data) {
    for (const [client, metadata] of clients) {
      const data2 = data.replace(metadata.id, `${metadata.id} (YOU)`);
      client.send(data2);
    }
  }
}

main();
