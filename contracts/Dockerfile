# FundRail Soroban contracts — reproducible build & test environment.
#
#   docker build -f contracts/Dockerfile -t fundrail-contracts contracts
#   docker run --rm fundrail-contracts
#
# Runs the full Rust workspace test suite against a pinned toolchain, so every
# contributor sees identical results regardless of their host setup.

FROM rust:1.85-slim

WORKDIR /contracts

# Add the wasm target used to produce deployable Soroban contracts.
RUN rustup target add wasm32-unknown-unknown

COPY Cargo.toml ./
COPY funding_stream/Cargo.toml ./funding_stream/
COPY splitter/Cargo.toml ./splitter/
COPY registry/Cargo.toml ./registry/
COPY token_vault/Cargo.toml ./token_vault/

# Fetch dependencies once so source changes don't re-download the crate graph.
RUN cargo fetch

COPY . .

# Verify the wasm artifact builds, then run the full test suite.
RUN cargo build --workspace --target wasm32-unknown-unknown --release \
    && cargo test --workspace

CMD ["cargo", "test", "--workspace"]
