FROM counterparty/base

MAINTAINER Counterparty Developers <dev@counterparty.io>

# Install newest stable nodejs and npm
RUN apt-get update && apt-get -y remove nodejs npm gyp
RUN curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
RUN apt-get update && apt-get -y install nodejs
RUN echo "Using nodejs version `nodejs --version` and npm version `npm --version`"

# zmq
RUN apt-get install -y libzmq3-dev

# npm dependencies
RUN npm install -g node-gyp forever

# install counterparty-indexd
RUN mkdir -p /data/indexd/
RUN mkdir /indexd
WORKDIR /indexd
RUN git clone https://github.com/CounterpartyXCP/indexd-server.git /indexd
RUN npm install

# start script
COPY ./start.sh /usr/local/bin/start.sh
RUN chmod a+x /usr/local/bin/start.sh

EXPOSE 8432 18432

# start indexd
ENTRYPOINT ["start.sh"]
