# Astrea Labs Monorepo Developer Tasks
# Reference: KingMoonk/TRAINER task architecture adapted for Next.js / TypeScript

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help message
	@echo "Astrea Labs Monorepo Commands:"
	@echo "----------------------------------------------------"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

.PHONY: setup
setup: ## Install all dependencies via pnpm
	pnpm install --frozen-lockfile || pnpm install

.PHONY: dev
dev: ## Run development server across all apps and packages via Turborepo
	pnpm dev

.PHONY: build
build: ## Build all workspaces for production
	pnpm build

.PHONY: lint
lint: ## Run linter across workspaces
	pnpm lint

.PHONY: typecheck
typecheck: ## Run TypeScript compiler typechecks across all packages and apps
	pnpm typecheck

.PHONY: test
test: ## Run Vitest unit & component test suite
	pnpm test

.PHONY: test-e2e
test-e2e: ## Run Playwright end-to-end tests across root domain and subdomains
	pnpm test:e2e

.PHONY: format
format: ## Format repository with Prettier
	pnpm format

.PHONY: clean
clean: ## Clean build caches, .turbo, and node_modules
	pnpm clean
