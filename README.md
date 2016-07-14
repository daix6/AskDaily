# Ask Daily

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)
[![Build Status](https://travis-ci.org/daix6/AskDaily.svg?branch=master)](https://travis-ci.org/daix6/AskDaily)

Ask technological question daily! Ask Daily reads your questions' markdown files and generates a static website for you!

## Usage

### Generate a Question

There is an `cli.js` in the root directory. You can create a question easily with it in Command Line.

```bash
node cli.js [today] # today
node cli.js year month date # specified date that should be valid.
```

### Fill YAML Front-Matter Headers

The `cli.js` will automatically generate the front-matter header for you, which is required for generate the website. So fill out it in format.

```yaml
---
questions: How to use Ask Daily?
tags: question, web
---
```

*Note* that `tags` field can't end up with `,`.

### Emoji :kissing:

You can use emoji in your question body now. Use it with the format `:smile:`. And you **shall not use emoji in the front-matter header**, otherwise exceptions may throw.

```markdown
The answer is a! :smile:.
```

All the emojis' svg comes from [emojione](http://emojione.com/). And it also provides a [cheat sheet](http://emoji.codes/) for reference~ There is a another [cheat sheet](http://www.emoji-cheat-sheet.com/) you can refer to.

### Preview

Run the following commands to preview it locally.

```bash
npm i # Please make sure that you have installed dependencies
npm i -g gulp
gulp serve
```

### Deploy to Github Pages

You can customize the remote and branch in `gulpfile.js`.

```bash
gulp deploy
```

## Thanks

This website's style is strongly influenced by [Joyee Cheung's diary generator](http://joyeecheung.github.io/diary/). Thank her!
