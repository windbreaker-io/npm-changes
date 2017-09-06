FROM node:8.4.0-alpine

ENV HOME=/usr/npm-watcher

RUN mkdir -p $HOME

WORKDIR $HOME

RUN apk update && apk upgrade && \
    apk add --no-cache git

ADD package.json $HOME
RUN npm install --silent
