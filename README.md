# Bible Rush

Jogo de sobrevivência em 3D com visual de pixel art, com heróis do Antigo Testamento: Davi, Sansão, Moisés, Josué e Débora.
Escolha um herói e um dos quatro cenários, erga as três Pedras do Memorial e derrote o chefe.
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
