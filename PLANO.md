# Bible Rush — Plano da grande atualização

Plano em fases. Cada fase termina com o jogo jogável, testado e publicado no GitHub Pages,
então dá para parar entre uma e outra sem deixar nada quebrado.

Referência estudada: PokéBonk (30 capturas e 3 vídeos em `Downloads/Referencia`).
A ideia não é copiar o visual dele (branco, arredondado), e sim os **princípios**, aplicados ao
nosso estilo: pixel art, pergaminho, couro, dourado e vinho, fontes Jersey.

---

## O que tirar das referências

| No PokéBonk | Princípio | No Bible Rush |
|---|---|---|
| Stardust ganho ao fim de cada partida | Toda partida rende algo, mesmo perdendo | **Denários** ao fim da partida |
| Laboratório: Treinamento + Equipe da partida + Itens | Uma loja com 3 papéis claros: força permanente, ferramentas, escolha do que aparece | **Mercado** com abas Treinamento, Ferramentas, Arsenal, Mochila, Guarda-roupa |
| Mochila (Rare Candy, Lucky Egg…) até 2 por partida | Consumível escolhido antes de jogar dá decisão sem desequilibrar | **Alforje**: até 2 itens por partida |
| Atualizar / Pular / Banir no level-up | Controle sobre a sorte das cartas | **Renovar / Pular / Banir** nas cartas |
| Carta mostra "104 → 122" e "Afeta: Ember, Fire Spin" | Mostrar o efeito exato antes de escolher | Números antes → depois em toda carta |
| Evolução na linha do Pokémon | Personagem que cresce com você | **Evolução do herói** por tempo jogado com ele |
| Guarda-roupa, molduras, avatares | Cosmético como recompensa de longo prazo | Roupas, acessórios, paletas, molduras |
| Pokédex com silhuetas + Caderno de pesquisa | Coleção visível, o que falta aparece como silhueta | **Bestiário** + molduras por "pesquisa" |
| Tarefas do dia (3) e da semana (3) | Motivo para voltar todo dia | **Tarefas** diárias e semanais |
| Conquistas com botão "Resgatar" | Recompensa que o jogador coleta (momento de prazer) | Troféus passam a pagar denários |
| Mapa da zona com névoa e lista do que foi achado | Mapa grande precisa de orientação | **Minimapa** + mapa na pausa |
| Altares, máquina que funde, Ditto, cogumelo que pula | Cenário cheio de decisões, não só de inimigos | Objetos interativos bíblicos (lista na Fase 1) |
| Pausa com painéis: ataques (% do dano, dano/s), itens, atributos | Explicar a build para o jogador entender o que funciona | Pausa com painéis e dicas em cada atributo |
| Tela final: dano por ataque, inimigos por espécie, "NOVO" | Mostrar o que aconteceu e o que avançou | Tela final com denários, dano por arma, bestiário |
| Normal / Difícil (×1,75) / Pesadelo (×2,5) | Desafio maior paga mais | Mesmas 3 dificuldades, liberadas ao vencer |
| Passo 1 de 6 (balões de tutorial) | Ensinar cada tela na primeira visita | Balões de tutorial em pergaminho |
| Faixa colorida no topo de cada painel | Cor por assunto ajuda a achar as coisas | Cor por assunto: vinho = armas, oliva = relíquias, azul = atributos, dourado = denários |

**Fica de fora por enquanto:** ranking online, temporadas, clã, cooperativo e conta na nuvem.
Todos precisam de um servidor, e o site é estático. Alternativa já possível: recordes pessoais
locais e um código para exportar e importar o progresso.

---

## Fase 0 — Preparar a base

1. Sincronizar esta pasta com o GitHub (o Antigravity publicou a animação de derrota em `80a0bf9`).
2. Conferir a vitória: no GitHub só está a derrota. Se faltar, terminar a vitória
   (fanfarra, fogos, chefe se desfazendo em dourado, faixa dourada já desenhada em `assets/ui/ribbon-gold.png`).
3. **Perfil versão 2** (o save no navegador), com migração do perfil atual sem perder troféus:
   ```js
   {
     v: 2,
     denarios: 0,
     trophies: {}, claimed: {},          // troféus já resgatados
     wins: {},                           // { davi: { ela: 'normal' } }
     upgrades: {},                       // { forca: 2, vigor: 1 }
     tools: {},                          // { renovar: 1, pular: 2 }
     unlocked: [],                       // armas e relíquias compradas no Arsenal
     bag: {},                            // consumíveis do Alforje { mana: 2 }
     heroes: { davi: { xp: 0, look: {} } }, // evolução e roupa escolhida
     owned: [],                          // cosméticos comprados
     bestiary: {},                       // abates por tipo de inimigo
     tasks: { day: '', week: '', list: [], streak: 0 },
     records: {},                        // { 'ela:normal': 512 } melhor tempo
     seen: {}                            // tutoriais já vistos
   }
   ```
4. **Exportar / importar progresso** em Configurações (um código de texto), porque tudo vive no navegador.
5. Ampliar `check.mjs` com testes da migração do perfil.

---

## Fase 1 — Mapas duas vezes maiores, irregulares e únicos

### 1.1 Motor (vale para todos os mapas)

- **Tamanho (decidido): dobrar a área**, ou seja, raio × 1,41.

  | Mapa | Raio hoje | Raio novo |
  |---|---|---|
  | Vale de Elá | 92 m | 130 m |
  | Mar Vermelho | 86 m | 122 m |
  | Vale dos Ossos Secos | 88 m | 124 m |
  | Muralhas de Jericó | 90 m | 127 m |

  As funções de terreno de cada mapa usam posições fixas (montes, ribeiro, cidade); elas são
  redesenhadas para o novo tamanho, não só esticadas. Distâncias de ritmo (onde nascem os inimigos,
  distância entre as pedras, poços e baús) crescem junto para a corrida até as pedras continuar justa.
- Terreno de 256 m para ~352 m, mantendo um vértice a cada 2 m (de ~16 mil para ~31 mil vértices). Campo de fluxo dos inimigos,
  grade de obstáculos e grade espacial crescem junto (custo medido com `bench()`; meta: 60 fps com 500 inimigos).
- **Zonas:** cada mapa vira 3 zonas com cara própria, uma Pedra do Memorial em cada.
  A névoa de distância e o céu ajudam a esconder o tamanho.
- **Verticalidade de verdade:**
  - Terreno em **degraus** (platôs com paredões), como os terraços da Floresta Verde do PokéBonk.
  - Paredão alto bloqueia o herói e os inimigos; sobe-se por **rampas**, **escadas de corda** ou **pulo**.
  - Inimigos contornam paredões (o campo de fluxo marca degraus altos como bloqueados),
    então subir num platô vira tática: menos frentes de ataque.
  - **Rocha de Horebe** (Êx 17:6): fonte de água que lança o herói para cima de um platô.
- Densidade de cenário proporcional à área, com novos modelos no Blender (`tools/blender/assets.py`).
- **Minimapa** circular no canto, com ícones (pedras, poços, baús, mercador, chefe) e o rumo do herói.
- **Mapa na pausa:** visão do mapa inteiro com névoa (só aparece o que você já viu de perto),
  lista "Descoberto nesta zona" e até 3 marcas que viram setas na tela.

### 1.2 Cada mapa

> Considerei "vale" = **Vale de Elá** e "deserto" = **Mar Vermelho**. Se for outro, troca.

**Vale de Elá — o mapa vertical**
- Os dois montes dos exércitos viram platôs altos jogáveis: acampamento filisteu (tendas, escudos, carroças)
  e acampamento de Israel (tendas, fogueiras, bandeiras das tribos).
- O ribeiro desce em cascatas por três degraus, com pontes de tronco e pedras lisas para atravessar.
- Mirantes no alto de cada platô com um baú; trilhas em zigue-zague e rampas.
- **Caverna de Adulão** (1 Sm 22:1): túnel raso que atravessa um monte, atalho entre zonas.
- Árvores de terebinto (o vale leva o nome dele), oliveiras, rebanhos de ovelhas que fogem.

**Mar Vermelho — o deserto**
- **Campo de dunas no meio**: cristas onduladas que se movem devagar entre partidas,
  vale entre dunas (corredor) e topo de duna (visão ampla). Areia funda deixa o herói um pouco mais lento.
- Ruínas egípcias meio enterradas: colunas tombadas, obeliscos, uma esfinge quebrada, carros de guerra abandonados.
- **Tempestade de areia** periódica: visão curta, inimigos mais lentos.
- **O mar se abre** (Êx 14:21): evento em que as águas se partem e revelam um corredor no fundo
  com tesouros por 40 s, e depois fecham (quem ficar dentro toma dano; inimigos são levados).
- Pequeno oásis com palmeiras e um poço.

**Vale dos Ossos Secos — o cânion**
- Paredões altos formando corredores, bifurcações e becos (perigoso ser cercado).
- Plataformas de rocha, uma ponte natural de pedra, grutas.
- Pilhas de ossos que se levantam quando o vento sopra (já existe; vira o evento central de uma zona).
- Centro em anfiteatro: arena aberta onde o chefe aparece.

**Muralhas de Jericó — a cidade**
- A cidade no monte ganha ruas internas, casas, praça e mercado; muralha dupla com portões.
- Palmeiral e oásis ao lado (a "cidade das palmeiras").
- Leitos secos de rio (uádis) cortando o terreno como valas.
- Colinas de calcário com cavernas; a casa de Raabe no muro com o cordão escarlate.

### 1.3 Objetos interativos (o "cenário com decisões")

| No PokéBonk | No Bible Rush | Efeito |
|---|---|---|
| Altar Unown (bênção) | **Altar de Betel** (Gn 28) | Bênção aleatória por 60 s |
| Altar de Porygon (troca atributo) | **Balança do Templo** | Troca 10% de um atributo por 15% de outro |
| Máquina do Bill (funde golpes) | **Forja de Tubalcaim** (Gn 4:22) | Funde duas armas no nível máximo numa arma combinada |
| Hypno (esquece golpes) | **Escriba** | Apaga uma arma e devolve os níveis como ouro |
| Ditto (clona item) | **Vaso da viúva** (2 Rs 4) | Duplica uma relíquia comum |
| Meowth com loja | **Caravana ismaelita** (Gn 37:25) | Passa pelo mapa vendendo itens por ouro da partida |
| Rocha de ouro | **Veio de prata** | Quebrar dá ouro |
| Berries | **Figueira e romãzeira** | Frutas que curam |
| Cogumelo saltitante | **Rocha de Horebe** | Lança o herói para cima |
| Fragmento de cometa (carregar) | **Brasa do altar** (Is 6:6) | Levar a brasa até o próximo altar antes que apague: recompensa grande |
| Unown "aguente no círculo" | Pedras do Memorial | Já existe |
| Pokémon Alfa | **Campeão** | Inimigo gigante; derrotado sem tomar dano, vira aliado na partida (ver Fase 5) |
| (novo) | **Jarros de Gideão** (Jz 7:20) | Jarro que quebra e solta luz, atordoando inimigos em volta |

---

## Fase 2 — Denários e o Mercado

### 2.1 Quanto se ganha

Moeda fora da partida: **denário**. Dentro da partida continua o **ouro**.

```
denários = 3 por minuto sobrevivido
         + 1 a cada 25 abates
         + 10 por Pedra do Memorial erguida
         + 5 por baú aberto
         + 60 por chefe derrotado
         × dificuldade (Normal 1, Difícil 1,75, Pesadelo 2,5)
```

Uma partida perdida aos 5 min rende ~40; uma vitória no Normal rende ~180.
Com custos subindo ~35% por nível, completar uma melhoria do Treinamento leva umas 12 a 15 vitórias.
Também pagam denários: troféus (resgatados), tarefas diárias e semanais.
A tela final mostra a conta linha por linha, com os números subindo.

### 2.2 O Mercado (tela nova no menu)

Barraca de mercado em pixel art, com o mercador ao lado. Cinco abas:

**Treinamento** — melhorias permanentes; cada nível custa mais que o anterior.

| Melhoria | Por nível | Níveis | Custo inicial |
|---|---|---|---|
| Força | +4% dano | 8 | 85 |
| Vigor | +8 vida máxima | 8 | 85 |
| Ligeireza | +2,5% velocidade | 6 | 100 |
| Sabedoria | +5% experiência | 6 | 100 |
| Bênção | +5 sorte | 6 | 120 |
| Colheita | +0,6 alcance de coleta | 5 | 70 |
| Maná | +0,2 vida por segundo | 5 | 100 |
| Couraça | +2 armadura | 6 | 100 |
| Precisão | +1% crítico | 5 | 170 |
| Destreza | +2% velocidade de ataque | 5 | 185 |
| Alcance | +3% área | 5 | 170 |

**Ferramentas** — mudam a partida inteira.

| Ferramenta | Efeito | Custo |
|---|---|---|
| Renovar | +1 uso de trocar as cartas por partida | 100 |
| Pular | +1 uso de pular cartas (dá ouro) | 70 |
| Banir | +1 uso de tirar uma opção pelo resto da partida | 130 |
| 4ª carta | Toda subida de nível mostra 4 cartas (Débora passa a ver 5) | 1.000 |
| 4ª arma | Mais um espaço de arma | 1.200 |
| Cordão de reserva | Começa com 1 ressurreição | 900 |

**Arsenal** — armas e relíquias novas não aparecem logo; o jogador escolhe quais desbloquear
(na ordem que quiser) e elas passam a sair nos baús e cartas. Funciona junto com os troféus.

**Alforje** — consumíveis; leva até 2 por partida, gastos ao começar.
Maná do céu (começa com 2 níveis), Óleo da unção (+25% experiência), Bolsa de prata (+50% ouro),
Mel silvestre (um carregador de tesouro a mais), Estrela de Belém (primeiro baú é raro).

**Guarda-roupa** — ver Fase 3.

### 2.3 Nas cartas de nível

Botões **Renovar (F)**, **Pular (X)**, **Banir (Z)** com o número de usos;
etiqueta NOVO / MELHORIA; números antes → depois; "Afeta: Funda, Granizo".

---

## Fase 3 — Evolução dos heróis e cosméticos

### 3.1 Evolução por tempo jogado

Cada herói acumula **experiência de herói** (minutos jogados com ele + bônus por vitória).
Três estágios; o modelo 3D, o retrato e o card mudam a cada um, e cada estágio dá um bônus pequeno.

| Herói | Estágio 1 | Estágio 2 (60 min) | Estágio 3 (180 min) |
|---|---|---|---|
| Davi | Pastor (atual) | **Guerreiro de Saul**: couraça de couro, espada de Golias nas costas | **Rei Davi**: coroa, manto vermelho e dourado, harpa no cinto |
| Sansão | Nazireu (atual) | **Juiz de Israel**: tranças mais longas, braceletes de bronze | **Sansão de Gaza**: portões da cidade nas costas, olhar de fogo |
| Moisés | Pastor de Midiã | **Profeta**: cajado-serpente, manto azul | **Legislador**: tábuas da lei, rosto que brilha (Êx 34:29) |
| Josué | Servo de Moisés | **Espião de Canaã**: capa de viagem, cacho de uvas | **Comandante**: armadura completa, estandarte |
| Débora | Profetisa | **Juíza** sob a palmeira: véu bordado | **Mãe em Israel** (Jz 5:7): coroa de folhas, arco dourado |

Bônus por estágio: +5% de um atributo do papel do herói, e no estágio 3 uma variação do milagre
(ex.: o Sol Parou de Josué dura 2 s a mais).

**Como fazer:** os estágios usam o mesmo esqueleto e as mesmas animações, só com peças extras,
então `tools/blender/heroes.py` gera `hero_davi_2.glb` e `hero_davi_3.glb` reaproveitando o corpo.
O card do herói mostra a linha de evolução (como "Nv. 24 › Nv. 44" no PokéBonk) e uma barra de progresso.

### 3.2 Cosméticos (Guarda-roupa)

- **Paletas** de roupa por herói (troca as cores do modelo sem mudar a forma). Ex.: Túnica de muitas cores.
- **Acessórios** presos à cabeça ou às costas: coroa de louros, turbante, capuz, aljava dourada.
  São peças pequenas presas ao osso da cabeça, sem refazer o herói.
- **Rastros**: pó dourado, pétalas, faíscas ao andar.
- **Molduras** do retrato no HUD e na tela final.
- Compra com denários, ou ganho por troféu e bestiário (alguns só se conquistam, não se compram).
- Prévia em 3D na tela de escolha do herói, girando.

---

## Fase 4 — Telas e interface

Princípios: hierarquia clara (título grande, número grande, detalhe pequeno), cor por assunto,
cards com faixa colorida no topo, barras de progresso em tudo que avança, silhueta para o que
falta, dica ao passar o mouse em cada atributo, atalho de teclado escrito em cada botão.
Tudo com as molduras de pixel art que já temos.

1. **Menu principal vira um hub**: Jogar, Mercado, Tarefas, Bestiário, Troféus, Configurações;
   barra no topo com denários, retrato do herói e nível de conta.
2. **Escolha do herói**: card grande com papel ("Ágil, à distância"), passiva, arma inicial e estágio;
   ao confirmar, um aviso com o retrato. Tela de detalhe: atributos em barras, kit, milagre,
   linha de evolução, vitórias por dificuldade, guarda-roupa.
3. **Escolha do mapa**: prévia grande, etiquetas ("Vertical", "Dunas"), descrição, as 3 zonas
   com seus guardiões, seu recorde, dificuldade com o multiplicador de denários.
4. **Cartas de nível**: faixa da cor da raridade, ícone grande, números antes → depois, Renovar/Pular/Banir.
5. **HUD**: minimapa, relógio em pílula, contador de sequência grande ("×89"), aviso do próximo chefe
   ("Golias em 4:23"), barra de experiência.
6. **Pausa**: painéis Armas (dano de cada uma, % do total, dano por segundo), Relíquias, Atributos
   (tabela completa com dicas); botões Desistir, Reiniciar, Mapa, Configurações, Continuar.
7. **Tela final**: título ("Vitória!" ou "Você resistiu 8:13"), denários ganhos linha por linha,
   dano por arma, inimigos derrotados por tipo com selo NOVO, troféus da partida.
8. **Tutorial em balões** na primeira visita a cada tela ("Passo 1 de 6"), em pergaminho.

---

## Fase 5 — Progressão de longo prazo

1. **Troféus pagam denários** com botão Resgatar e animação; abas por categoria; alguns dão **títulos**
   ("Matador de gigantes") que aparecem sob o nome do herói.
2. **Tarefas**: 3 por dia (fácil, média, difícil) e 3 por semana, sorteadas pela data,
   com troca grátis de uma; prêmio extra ao completar as 3 (denários e itens do Alforje). Sequência de dias.
3. **Bestiário**: inimigos (silhueta até derrotar o primeiro), armas, relíquias e itens.
   Derrotar 50 de uma família completa a "pesquisa" e libera uma moldura com o tema dela.
4. **Dificuldades** Difícil e Pesadelo, liberadas ao vencer o mapa na anterior; inimigos +70% e +160%.
5. **Modo Sobrevivência**: um mapa só, horda sem fim, um chefe a cada 5 min e, depois de vencê-lo,
   uma **aliança** (poder forte em troca de uma maldição). Recorde por mapa.
6. **Valentes de Davi** (2 Sm 23): campeões derrotados de um jeito especial passam a lutar ao seu lado
   naquela partida (até 2).

---

## Ordem sugerida e tamanho

| Fase | O que entrega | Tamanho |
|---|---|---|
| 0 | Base sincronizada, perfil novo, vitória | pequeno |
| 1 | Mapas 2×, verticalidade, minimapa, objetos interativos | **grande** (fazer mapa por mapa: Elá → Mar → Ossos → Jericó) |
| 2 | Denários, Mercado, Renovar/Pular/Banir | médio |
| 3 | Evolução dos 5 heróis, cosméticos | grande (modelos no Blender) |
| 4 | Telas novas | médio |
| 5 | Troféus com prêmio, tarefas, bestiário, dificuldades, sobrevivência | médio |

Sugestão: fazer a **Fase 2 antes da 1** se a prioridade for dar motivo para jogar de novo,
porque é mais rápida e já muda a sensação do jogo. A Fase 1 é a que mais pesa em desempenho
e precisa de teste em computador mais fraco.

Cada fase: testes em `check.mjs` (fórmula de denários, custos, estágios de evolução, migração do perfil),
teste no navegador (`bench()`, `dev.*`), commit e publicação.
