FROM node:lts

ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL ${NEXT_PUBLIC_APP_URL}

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL ${NEXT_PUBLIC_API_URL}

ARG NEXT_PUBLIC_PONDER_URL
ENV NEXT_PUBLIC_PONDER_URL ${NEXT_PUBLIC_PONDER_URL}

ARG NEXT_PUBLIC_WAGMI_ID
ENV NEXT_PUBLIC_WAGMI_ID ${NEXT_PUBLIC_WAGMI_ID}

RUN adduser --disabled-password --gecos "" appuser
RUN mkdir /app && chown -R appuser /app
WORKDIR /app
USER appuser

COPY --chown=appuser . .
RUN yarn install --frozen-lockfile
RUN yarn run build

CMD ["yarn", "start"]