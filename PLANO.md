# Bible Rush — Plano de expansão: verticalidade, Torre de Babel e polimento

Plano em passos. Cada passo termina com o jogo jogável, testado e publicado no GitHub Pages.
O plano anterior (Fases 0 a 5: mapas, Mercado, evolução dos heróis, telas, ranking) foi concluído
e está no histórico do git.

**Para quem for programar:** o jogo não usa classes por inimigo. Inimigos, tiros, gemas e partículas
são arrays fixos (`pool()` em `src/main.js`: `E`, `S`, `EP`, `G`, `PT`) com remoção por troca.
A altura do chão é `terrainH(x, z)`, a gravidade do jogo é `GRAVITY = 32` e `clamp()` é do próprio
`main.js` (não existe `Math.clamp`). Modelos novos saem de `tools/blender/assets.py`.

---

## O que o jogo já tem (não refazer)

| Item pedido | Situação |
|---|---|
| Evolução de armas (arma no máximo + relíquia, num baú) | Feito: 16 evoluções (`EVOLUTIONS`, `readyToEvolve`) |
| Brilho ao levar dano e empurrão | Feito: `E.flash`, `knock` em `damage()` |
| Números de dano com crítico dourado | Feito, com pool de elementos reaproveitados (`dmgEls`) |
| Object pooling | Feito: arrays fixos para tudo |
| Grade espacial para colisão | Feito: `SpatialHash` e `obGrid` |
| Diretor de ondas por tempo | Feito: ondas de 45 s, eventos do mapa a cada 150 s, elites aos 3 e 6 min, chefe furioso aos 10:00 |
| Rocha de Horebe (pula alto) | Feito: `pads` nos mapas |
| Fé por passar raspando (graze) | Feito: `EP.graze`; falta só a faísca e o som com tom subindo (5.2) |
| Pausar vídeos ao sair do setup | Feito: `syncMapVideo()` pausa tudo fora da tela de preparar |
| Excesso de gemas | Parcial: acima de 1.500 a gema vai direto para o herói; falta a fusão (5.1) |

---

## 1. Combate 3D e fim do "camping" no alto das pedras

Hoje os tiros inimigos (`EP`) só têm `vx` e `vz`: quem sobe num rochedo fica imune.

### 1.1 Tiro direto 3D (lanças, dardos, feixes)
Dar `vy` ao pool `EP` e mirar no peito do herói (`P.pos.y + 1`):

```js
const dx = P.pos.x - x;
const dy = (P.pos.y + 1) - (y + 1);
const dz = P.pos.z - z;
const d = Math.hypot(dx, dy, dz) || 1;
EP.vx[i] = (dx / d) * speed;
EP.vy[i] = (dy / d) * speed;
EP.vz[i] = (dz / d) * speed;
```
O modelo do tiro passa a apontar na direção 3D.

### 1.2 Tiro em arco (pedras, potes de fogo)
Se a diferença de altura passar de 1,5 m, lançar em arco com gravidade para a pedra passar por cima
da borda do platô e cair no herói:

```js
const t = clamp(Math.hypot(dx, dz) / speed, 0.45, 1.4); // tempo de voo
EP.vx[i] = dx / t;
EP.vz[i] = dz / t;
EP.vy[i] = (dy + 0.5 * G * t * t) / t; // no update: vy -= G * dt (G ≈ 18 para o arco ficar legível)
```

### 1.3 Aviso no chão
Para os tiros em arco, um círculo vermelho em `terrainH(alvoX, alvoZ)` que enche até o impacto
(reaproveitar `hazard()`, que já desenha esses círculos).

---

## 2. Inimigos novos: um voador e um escalador por cenário

Hoje nenhum inimigo sobe paredões. Só estes dois tipos passam a ignorar o bloqueio de inclinação
(`CLIFFS` e `flow.blocked`).

- **`fly: true`** — não usa o chão para bloquear. Altura alvo:
  `max(terrainH + 2.5, P.pos.y + 1.5 + sin(t * 3) * 0.5)`. A menos de 8 m do herói, dá um rasante.
- **`climb: true`** — ao achar parede íngreme, entra no estado "escalando": inclina o modelo contra
  a rocha, sobe com velocidade própria e pula para o topo do platô.

| Cenário | Voador | Como age | Escalador | Como age |
|---|---|---|---|---|
| Vale de Elá | Corvo de rapina (1 Sm 17:44) | Bando rápido, rasantes na diagonal que pedem o deslize | Batedor de Gate | Sobe com ganchos; no topo joga uma rede que deixa o herói 30% mais lento |
| Mar Vermelho | Gafanhoto da 8ª praga | Enxame que cospe ácido em arco de cima para baixo | Escorpião do Sinai | Sobe rochas e colunas depressa; dano contínuo ao encostar |
| Vale dos Ossos Secos | Crânio alado (os quatro ventos, Ez 37:9) | Flutua através dos obstáculos; feixes retos que miram na altura do herói | Ossada rastejante | Esqueleto de quatro patas; se reconstrói uma vez se não morrer com crítico |
| Jericó | Vigia de fogo cananeu | Sobrevoa soltando brasas que viram poças de fogo no alto das muralhas | Sitiador da muralha | Soldado com garras que sobe direto pelos blocos da muralha |

Entram no Bestiário (`BEAST_KINDS`) e nos pesos de spawn (`spawnWeights`).

---

## 3. Mapas mais verticais

Peças modulares com altura, colisão de verdade (caixas e rampas) e mais Rochas de Horebe.
Lembrete: o terreno é um mapa de alturas (não faz túneis nem pontes por baixo), então pontes e
passarelas são modelos com colisão por cima, como as muralhas de Jericó.

### 3.1 Vale de Elá
- Torres de vigia filisteias de 2 andares, ligadas por passarelas quebradas (pulo + deslize).
- Arcos de ruínas cananeias nas colinas: pilares caídos formam rampas até um platô com uma Pedra do Memorial.
- O ribeiro mais fundo, com pontes de rocha por cima: luta em dois níveis (na água, pegando as Cinco Pedras Lisas, ou em cima).

### 3.2 Mar Vermelho
- Terraços de coral e carros egípcios naufragados empilhados em 3 alturas nas bordas do corredor.
- Ruínas de Baal-Zefom: colunas egípcias quebradas no leito seco; a Rocha de Horebe leva ao topo
  dos capitéis e dá para pular de coluna em coluna.

### 3.3 Vale dos Ossos Secos
- Costelas de gigantes semienterrados formando arcos caminháveis sobre as crateras.
- Mausoléus em degraus; no topo do central, um baú selado de alto risco.

### 3.4 Jericó
- Muralha dupla com ameias caminháveis, torres de canto de 3 andares e trechos que desabam aos 5:00
  (muda o caminho de subida).
- Casas encostadas na muralha: correr pelos telhados.

---

## 4. Modo novo: Torre de Babel

Subida em arena fechada, andar por andar (na linha de *Hades* e *Bloody Palace*), cada vez mais
estreita e caótica.

### 4.1 Andares
- **Arena:** raio de 28 a 35 m (cerca de 20% de um mapa), octogonal ou circular, cercada de nuvens.
- **Cada andar sorteia 1 de 5 formatos**, em tijolos babilônicos:
  1. Anfiteatro: centro baixo e 2 anéis de arquibancada nas bordas.
  2. Zigurate central: pirâmide de 3 degraus com 2 Rochas de Horebe nas laterais.
  3. Pontes cruzadas: 4 pilares ligados por passarelas sobre um fosso de fogo.
  4. Espiral quebrada: rampa contínua pela borda até um platô suspenso.
  5. Sala do trono (andares de chefe): ampla, com 4 colunas que quebram e bloqueiam tiros do chefe.
- **Duração:** 45 a 75 s por andar. Meta de abates `25 + andar × 8`; os inimigos saem de portais nas paredes desde o início.

### 4.2 Progressão
1. **Nível por andar:** os inimigos ainda soltam maná (limpar rápido dá +1 nível), mas fechar o andar
   sempre garante uma escolha no topo da escada.
2. **Portais de subida (2 ou 3, à escolha):**
   - Arsenal (espada): cartas só de armas (novas ou melhorias).
   - Relíquias (cálice): cartas de relíquias e rolos (para evoluir armas).
   - Caravana de Ismael (pão): cura 30% da vida e dá siclos (a cada 3 andares).
3. **Marcos:**
   - Andares 1 a 4: hordas misturadas dos 4 cenários; montar o kit básico.
   - Andar 5: guardião da torre + baú garantido de evolução.
   - Andares 6 a 9: voadores e escaladores em dobro; começa a Confusão das Línguas.
   - Andar 10: Ninrode, o construtor de Babel (Gn 10:8-10), chefe próprio, ou dois chefes juntos.
     Vencer fecha a Torre; depois dela, a Subida Infinita (andar 11+) conta para o ranking da temporada.

### 4.3 Confusão das Línguas (Gn 11:7)
A cada 3 andares entra um modificador que vale até o fim do bloco:
- **Língua de fogo:** todo inimigo deixa uma brasa ao morrer; suas armas ganham +30% de área.
- **Vento de Sinar:** gravidade 35% menor (pulos altíssimos), mas voadores causam o dobro de dano.
- **Pressa dos construtores:** inimigos e herói 40% mais rápidos; recarga do `E` pela metade.
- **Torre inacabada:** blocos do chão afundam se o herói ficar parado mais de 3 s no mesmo lugar.

### 4.4 Onde entra
- Botão no `#modes` da tela de preparar e um cartão no menu inicial.
- `mode: 'babel'` na URL, como `surv`; arena gerada no lugar do mapa (`buildWorld`).

---

## 5. Polimento

### 5.1 Desempenho e sensação
- **Fusão de gemas:** acima de 120 gemas de maná a mais de 20 m do herói, juntar 5 próximas em 1 de
  valor maior (azul → verde → dourada).
- **Recuo da gema:** ao entrar no raio de coleta, a gema se afasta 100 ms antes de disparar para o herói.
- **Números de dano em canvas:** só se o pool atual de elementos pesar no desempenho (medir antes com `bench()`).

### 5.2 Interface e meta-jogo
- **Grimório na pausa:** as receitas `arma no máximo + relíquia = evolução` que o jogador já descobriu.
- **Baús de sorte:** baús de chefe e de emboscada rolam a Sorte para dar 3 itens (Bênção tripla) ou 5 (Arca transbordante), com fanfarra.
- **Salmos:** ao erguer as Pedras do Memorial (e nos andares 1 e 6 da Torre), escolher 1 Salmo que
  muda a build inteira. Ex.: Salmo 23, a cura que sobra vira uma explosão sagrada; Salmo 144, as armas
  físicas ricocheteiam.
- **Graze com efeito:** faísca dourada entre o tiro e o herói e um som que sobe de tom a cada raspão seguido.

---

## Ordem

| Passo | O quê | Situação |
|---|---|---|
| 1 | Mira 3D e tiro em arco (seção 1) + os estados `fly` e `climb` | Feito |
| 2 | Os 8 inimigos novos (seção 2) e as peças verticais dos mapas (seção 3) | Feito |
| 3 | Torre de Babel (seção 4) | Feito |
| 4 | Polimento (seção 5) | Feito |

**Como ficou (diferenças do plano):**
- Pontes e passarelas são blocos maciços com colisão por cima (o terreno é mapa de alturas e as colisões são círculos): não dá para passar por baixo delas.
- O "fundo do ribeiro" de Elá não foi rebaixado; no lugar, torres de vigia, ruína com rampa de pilares e mais altura nos mapas.
- O escorpião é mais rápido em vez de causar dano contínuo; o Salmo 23 virou uma explosão a cada 4 s com a vida cheia.
- Torre de Babel: as colunas da sala do trono não quebram; a Subida Infinita (andar 11+) existe, mas ainda não vai para o ranking da temporada (o servidor só aceita os 4 mapas: precisa mudar `tools/ranking.sql`).
- Números de dano continuam em elementos reaproveitados (o teste com 500 inimigos ficou em ~3 ms por quadro).
