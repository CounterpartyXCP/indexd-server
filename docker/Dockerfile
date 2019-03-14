FROM node:carbon

MAINTAINER Counterparty Developers <dev@counterparty.io>

RUN apt update
RUN apt install -y libzmq3-dev gcc g++ python3 build-essential


# install counterparty-indexd
RUN mkdir -p /data/indexd/
RUN mkdir /indexd
WORKDIR /indexd
COPY ./package.json /indexd

RUN echo "Using nodejs version `node --version` and npm version `npm --version`"
RUN npm install
COPY ./lib/* /indexd/lib/
COPY index.js /indexd

# start script
COPY ./docker/start.sh /usr/local/bin/start.sh
RUN chmod a+x /usr/local/bin/start.sh

EXPOSE 8432 18432 28432

# start indexd
CMD ["npm", "start"]
