# Put static variables up here.
# These would be nice inside of a config file or something.
cert-manager-version := v1.12.16

help:
	@awk '/^## / \
		{ if (c) {print c}; c=substr($$0, 4); next } \
			c && /(^[[:alpha:]][[:alnum:]_-]+:)/ \
		{print $$1, "\t", c; c=0} \
			END { print c }' $(MAKEFILE_LIST)

deploy:
	$(eval cluster := $(shell gcloud container clusters list --filter='name:coilysiren-deploy*' --format='value(name)'))
	gcloud container clusters get-credentials $(cluster) \
			--region us-west2-a
	kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/$(cert-manager-version)/cert-manager.yaml
