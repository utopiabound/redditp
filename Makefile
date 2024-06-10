help:
	@echo "Makefile Targets:"
	@echo " all	 - compress javascript"
	@echo " check    - all of the above"
	@echo " ---"
	@echo " checkjs  - eslint all javascript"
	@echo " checkcss - stylelint all css"

all: check js/jquery.touchwipe.min.js js/loglevel.min.js js/ie_hacks.min.js js/jquery.unevent.min.js

%.min.js: %.js
	uglifyjs $< --output $@ --compress --comments

checkjs:
	npx eslint js/script.js js/ie_hacks.js

check: checkjs checkcss

checkcss:
	npx stylelint --mw --rd --risd css/*.css
