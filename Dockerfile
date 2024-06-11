FROM node:lts

RUN adduser --disabled-password --gecos "" appuser
RUN mkdir /app && chown -R appuser /app
WORKDIR /app
USER appuser

COPY --chown=appuser . .
RUN yarn install --frozen-lockfile
RUN yarn run build

CMD ["yarn", "start"]