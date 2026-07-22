default:
  @just --list

install:
  vp install

dev:
  vp run dev

check:
  vp check
  vp run typecheck
  vp test
  vp run build

e2e:
  vp run test:e2e
