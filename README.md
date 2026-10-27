# Bible Rush

Jogo de sobrevivência em 3D com visual de pixel art, com heróis do Antigo Testamento: Davi, Sansão e Moisés.
Escolha um herói e um dos três vales, erga as três Pedras do Memorial e derrote o chefe.

**Jogar:** https://criativelucas.github.io/bible-rush/

## Controles

- **WASD**: mover (as armas atacam sozinhas)
- **Espaço**: pular · **Shift**: deslizar
- **E**: movimento especial · **Q**: milagre (com a Fé cheia)
- **Mouse** ou **setas**: girar a câmera · **Esc**: pausa

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
