DEFAULT_GOAL := help
.PHONY: deploy

help:
	@awk '/^## / \
		{ if (c) {print c}; c=substr($$0, 4); next } \
			c && /(^[[:alpha:]][[:alnum:]_-]+:)/ \
		{printf "%-30s %s\n", $$1, c; c=0} \
			END { print c }' $(MAKEFILE_LIST)

.deploy-pulumi:
	pulumi config set gcp:project coilysiren-deploy
	pulumi config set gcp:region us-west2
	pulumi up

.deploy-cert-manager: cert-manager-version
	$(eval cluster := $(shell gcloud container clusters list --filter='name:coilysiren-deploy*' --format='value(name)'))
	gcloud container clusters get-credentials $(cluster) \
			--region us-west2-a
	kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/$(shell cat cert-manager-version)/cert-manager.yaml
	touch .deploy-cert-manager

deploy:
	$(MAKE) .deploy-pulumi
	$(MAKE) .deploy-cert-manager
