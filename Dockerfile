FROM node:18-alpine3.14

WORKDIR /opt/project

COPY ./package.json ./package-lock.json ./tail.js /opt/project/

RUN npm install
RUN npm install -g nodemon
