# Bible Rush

Jogo de sobrevivência em 3D com visual de pixel art, com heróis do Antigo Testamento: Davi, Sansão, Moisés, Josué, Débora, Elias, Gideão, Daniel e Ester.
Escolha um herói e um dos seis cenários, erga as três Pedras do Memorial e derrote o chefe.
Cada jornada rende denários para o Mercado: melhorias permanentes, ferramentas para as cartas, armas, maestria e roupas.
Os heróis evoluem com o tempo jogado; há tarefas diárias, bestiário, troféus com títulos, dificuldades e o modo Sobrevivência.

**Jogar:** https://criativelucas.github.io/bible-rush/

## Controles

- **WASD**: mover (as armas atacam sozinhas)
- **Espaço**: pular · **Shift**: deslizar
- **E**: movimento especial · **Q**: milagre (com a Fé cheia)
- **Mouse** ou **setas**: girar a câmera · **Esc**: pausa
- Nas cartas de nível: **F** renovar · **X** pular · **Z** banir

## Ranking online (Supabase, gratuito)

O ranking da temporada (abates, vitórias mais rápidas e Sobrevivência) precisa de um banco de dados.
Sem ele o jogo funciona normalmente, só que sem ranking online. Para ligar:

1. Crie uma conta e um projeto em https://supabase.com (plano Free).
2. No projeto, abra **SQL Editor > New query**, cole todo o conteúdo de `tools/ranking.sql` e clique em **Run**.
3. Em **Project Settings > API**, copie a **Project URL** e a chave **anon public**.
4. Cole as duas em `src/online.js` (`SUPABASE_URL` e `SUPABASE_KEY`) e publique.

A chave "anon public" foi feita para ficar no site: ela só consegue chamar as duas funções do ranking,
que conferem cada partida antes de contar. Não use a chave "service_role" aqui.

## Rodar no computador

O jogo é um site estático (three.js pelo navegador, sem compilação). Ele precisa ser servido por HTTP:

```bash
python3 serve.py
```

Depois abra http://localhost:5173.

## Estrutura

- `index.html`: telas, HUD e estilo
- `src/`: o jogo (`main.js`), os mapas (`world.js`), os dados de heróis, armas e relíquias (`content.js`)
- `assets/models/`: modelos 3D gerados no Blender por `tools/build_models.sh`
- `assets/ui/`: molduras e ícones em pixel art gerados por `tools/make_ui.py`
- `check.mjs`: testes das regras do jogo (`node check.mjs`)

## Verificações

```bash
node check.mjs
node check-regressions.mjs
```

Ferramentas de teste (`dev`, `arm`, `bench` e tecla K) só ficam disponíveis em
localhost com `?debug=1`. Essas partidas não são enviadas ao ranking.

## Atualização de balanceamento e ranking

A horda da Sobrevivência agora usa tempo em combate, exige amostras recentes,
varia no máximo 10% a cada 30 segundos e tem multiplicador limitado a 8.
A Torre usa sua progressão por andar e tempo, sem esse multiplicador adaptativo.
Chefes secretos aguardam pelo menos 3 minutos e nível 12; na Torre, a Serpente
aguarda o andar 6 e não aparece em andares de chefe.

Recordes locais da Torre agora separam andares de segundos. O antigo campo misturado
é preservado, mas o andar é recuperado apenas de partidas pendentes e do troféu de Ninrode.

Para uma instalação existente do Supabase, execute **somente**
`tools/fix-ranking-classic.sql` no SQL Editor para separar a classificação de
vitórias do Clássico das partidas da Torre. O deploy do GitHub Pages não aplica SQL.
O ranking continua baseado em resultados enviados pelo cliente; retirar ferramentas
de debug da origem pública não equivale a uma validação antitrapaça no servidor.

## Novas armas e relíquias

As armas são desbloqueadas em **Mercado → Arsenal**. Depois da compra, aparecem
nas cartas de nível e no Caminho do Arsenal da Torre; têm cinco níveis e maestria.
As novas relíquias podem aparecer em baús, caravanas e no Caminho das Relíquias.

| Arma | Preço | Estilo | Relíquia para evoluir | Evolução |
| --- | ---: | --- | --- | --- |
| Espada de Gideão | 180 | Corte amplo, pouco empurrão | Lã de Gideão | Clamor dos Trezentos |
| Incensário de Arão | 240 | Aura de dano e lentidão em inimigos comuns | Flor de Amendoeira | Incenso da Aliança |
| Rolo de Zacarias | 260 | Projétil que atravessa e retorna | Selo de Jeremias | Sentença Voante |

Para evoluir, chegue ao nível 5 da arma, encontre a relíquia e abra outro baú.
Lã dá esquiva (+3% na raridade Barro), Flor aumenta o ganho de Fé (+12%) e
Selo aumenta o multiplicador de dano crítico (+0,15). A raridade amplia esses bônus.
As mecânicas são adaptações lúdicas, inspiradas nas referências indicadas nos itens.

## Elias — novo herói

Desbloqueie Elias ao conquistar **Coluna de Fogo** (atravessar uma noite inteira).
Perfis que já possuem esse troféu recebem o personagem automaticamente.

- **Arma inicial:** Brasas do Carmelo, projéteis perfurantes que incendeiam.
- **Passiva:** +15% de chance de queimar e +20% de ganho de Fé.
- **E — Passo de Fogo:** investida que causa dano e deixa fogo por 2 s; recarga de 4 s.
- **Q — Fogo do Carmelo:** 12 colunas de fogo sobre inimigos próximos, consumindo 100 de Fé.
- **Evolução:** Brasas nível 5 + Manto de Elias + outro baú → Labaredas do Carmelo.
- **Estágios:** Tisbita → Profeta do Carmelo → Profeta do Redemoinho.

Brasas também podem aparecer nas cartas dos outros heróis. O modelo animado está em
`assets/models/heroes/elias.glb`; sua fonte está em `tools/blender/heroes.py`.

**Ranking:** execute `tools/add-elias-ranking.sql` no SQL Editor do Supabase. Essa
migração preserva os dados existentes, permite Elias e inclui a separação do ranking
Clássico/Torre. Enquanto o servidor não aceitar Elias, partidas recusadas por esse
motivo ficam na fila local de reenvio (sujeita ao limite existente de 10 pendências).

## Gideão, Daniel, Monte Carmelo e Batalha na Babilônia

- **Gideão** (troféu *Ungido*: nível 20): Espada de Gideão; +10% crítico e +25% dano crítico.
  E — Grito dos Trezentos (investida que atordoa). Q — Cântaros e Tochas: atordoa a horda por 4 s e acende tochas ao redor.
  Estágios: Lavrador de Ofra → Valente de Israel → Juiz de Israel.
- **Daniel** (troféu *O Senhor é Deus*: vencer no Monte Carmelo): arma nova Mão que Escreve
  (luz do alto sobre o inimigo mais forte; evolui com o Candelabro de Ouro em Mene, Tequel, Parsim).
  +15% XP e +1 renovação. E — Firme na Oração. Q — Cova dos Leões: 5 s intocável e leões de luz.
  Estágios: Cativo de Judá → Sábio da Babilônia → Príncipe dos Sátrapas.
- **Monte Carmelo** (troféu *Os Valentes*): monte em terraços sobre o mar, altar de Elias com 12 pedras e o altar de Baal.
  Inimigos próprios (profetas de Baal e de Aserá, soldados de Samaria, abutres de Jezreel), chefe **Acabe**, chefe secreto **Jezabel**.
- **Batalha na Babilônia** (troféu *Relicário*): Jardins Suspensos em terraços largos cheios de árvores, zigurate e templos
  de tijolos azuis vidrados, Porta de Ishtar, rio Eufrates. Inimigos próprios (soldados babilônios, arqueiros e magos caldeus,
  estátua de ouro, guardas de Ishtar, leões alados), chefe **Nabucodonosor**, chefe secreto **Belsazar**.

Modelos: `tools/blender/heroes.py` (`ONLY=gideao,daniel` reconstrói só esses) e `tools/blender/assets.py`.
**Ranking:** execute `tools/add-new-content-ranking.sql` no SQL Editor do Supabase; até lá as partidas novas ficam na fila local.

## Ester, mapas maiores, novos inimigos, mini-chefes e eventos marcados

- **Ester** (troféu *Riqueza de Salomão*): arma nova **Cetro de Ouro** (raios que perseguem; evolui com o Anel de José em
  Favor da Rainha). +25% siclos e +10% área. E — Diante do Rei (deixa lento). Q — Decreto do Rei (fere, deixa lenta a horda e cura 30%).
- **Mapas 20% maiores** (`MAP_K` em `src/content.js`), relevo mais alto (`MAP_V`) e colinas extras fora do início.
- **2 inimigos novos por cenário:** lançador de potes de fogo (arco, marca no chão) e sacerdote que cura a horda.
- **2 mini-chefes por cenário** (2:30 e 5:30; na Sobrevivência a cada 4 min): campeão com maça e feiticeiro com leque de tiros. Deixam baú.
- **Eventos marcados:** coluna de luz no mundo, estrela no minimapa/mapa e seta no topo com nome e distância.
  A cada 70 s: chuva de maná, arca do tesouro ou acampamento inimigo. Campeões, tesouro em fuga e chefes também são marcados.
- **Itens interativos novos:** Shofar (empurra e atordoa a horda) e Cesto de maná (cura 35%).
- Chão com mais variação (manchas de cor, encostas, musgo, escorridos nas rochas) e visão mais longa.
