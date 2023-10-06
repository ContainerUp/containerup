package adapter

var legacy = false

func UseLegacy() {
	legacy = true
}

func IsUsingLegacy() bool {
	return legacy
}
